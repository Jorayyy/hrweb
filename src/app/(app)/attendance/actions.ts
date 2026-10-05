"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import {
  attendanceDay,
  attendanceStatus,
  employee,
  holidayCalendar,
  shiftTemplate,
} from "@/db/schema";
import { computeDay, type PunchSet } from "@/lib/attendance/compute";
import { requireRole } from "@/lib/auth";
import { field, isIsoDate, oneOf, type FormState } from "@/lib/form";
import { manilaDayOfWeek, manilaToUtc, nightOverlapSeconds } from "@/lib/time";

const RULE_VERSION = "att-2026.2";
const DAY_MS = 86_400_000;
const START_HOUR = 8;

type Status = (typeof attendanceStatus.enumValues)[number];

const PUNCHED: readonly Status[] = ["PRESENT", "HALF_DAY", "REST_DAY_WORKED"];
const UNPAID: readonly Status[] = ["ABSENT", "LWP", "SUSPENDED"];

const TIME = /^\d{2}:\d{2}$/;

function utcAt(workDate: string, hhmm: string): number {
  const [y, m, d] = workDate.split("-").map(Number);
  const [h, min] = hhmm.split(":").map(Number);
  return manilaToUtc(y, m - 1, d, h, min);
}

const PUNCH_FIELDS = [
  "punchIn",
  "break1Out",
  "break1In",
  "lunchOut",
  "lunchIn",
  "break2Out",
  "break2In",
  "punchOut",
] as const;

export async function saveAttendanceDay(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("ADMIN", "HR");

  const employeeId = Number(field(formData, "employeeId")) || null;
  const workDate = field(formData, "workDate");
  const status = field(formData, "status");
  const hoursRaw = Number(field(formData, "scheduledHours") || "8");
  const times = Object.fromEntries(
    PUNCH_FIELDS.map((name) => [name, field(formData, name)]),
  ) as Record<(typeof PUNCH_FIELDS)[number], string>;

  const errors: Record<string, string> = {};
  if (!employeeId) errors.employeeId = "Employee is required.";
  if (!isIsoDate(workDate)) errors.workDate = "A valid date is required.";
  if (!oneOf(status, attendanceStatus.enumValues)) errors.status = "Unknown status.";
  if (!Number.isFinite(hoursRaw) || hoursRaw <= 0 || hoursRaw > 24)
    errors.scheduledHours = "Hours must be between 0 and 24.";
  for (const name of PUNCH_FIELDS) {
    if (times[name] && !TIME.test(times[name])) errors[name] = "Use HH:MM.";
  }
  const needsPunch = oneOf(status, attendanceStatus.enumValues) && PUNCHED.includes(status as Status);
  if (needsPunch && (!TIME.test(times.punchIn) || !TIME.test(times.punchOut))) {
    errors.punchIn = "Punch in and out are required for this status.";
  }
  if (Object.keys(errors).length > 0) return { errors };

  const [emp] = await db
    .select({ id: employee.id, weeklyRestDays: employee.weeklyRestDays, shiftTemplateId: employee.shiftTemplateId })
    .from(employee)
    .where(eq(employee.id, employeeId as number))
    .limit(1);
  if (!emp) return { errors: { employeeId: "Employee not found." } };

  // ponytail: check-then-write TOCTOU window of one round trip — fine for HR traffic
  const [existing] = await db
    .select({ reviewedAt: attendanceDay.reviewedAt })
    .from(attendanceDay)
    .where(
      and(eq(attendanceDay.employeeId, employeeId as number), eq(attendanceDay.workDate, workDate)),
    )
    .limit(1);
  if (existing?.reviewedAt) {
    return {
      errors: { workDate: "This day is approved — reopen it in DTR Review before editing." },
    };
  }

  const shift = emp.shiftTemplateId
    ? ((await db
        .select()
        .from(shiftTemplate)
        .where(eq(shiftTemplate.id, emp.shiftTemplateId))
        .limit(1))[0] ?? null)
    : null;

  const incomplete = status === "INCOMPLETE_PUNCH";
  const inMs = times.punchIn ? utcAt(workDate, times.punchIn) : null;
  const roll = (hhmm: string): Date | null => {
    if (!hhmm) return null;
    let ms = utcAt(workDate, hhmm);
    if (inMs !== null) while (ms < inMs) ms += DAY_MS;
    return new Date(ms);
  };

  const punchInUtc: Date | null = inMs !== null ? new Date(inMs) : null;
  let punchOutUtc: Date | null = null;
  const break1OutUtc = roll(times.break1Out);
  const break1InUtc = roll(times.break1In);
  const lunchOutUtc = roll(times.lunchOut);
  const lunchInUtc = roll(times.lunchIn);
  const break2OutUtc = roll(times.break2Out);
  const break2InUtc = roll(times.break2In);

  let scheduledSeconds = Math.round(hoursRaw * 3600);
  let workedSeconds = 0;
  let lateSeconds = 0;
  let undertimeSeconds = 0;
  let otSeconds = 0;
  let nightSeconds = 0;
  let nightOtSeconds = 0;
  let paidBreakSeconds = 0;
  let computedNote: string | null = null;

  if (shift) {
    if (times.punchOut) {
      let outMs = utcAt(workDate, times.punchOut);
      while (inMs !== null && outMs <= inMs) outMs += DAY_MS;
      punchOutUtc = new Date(outMs);
    }
    const punches: PunchSet = {
      inUtc: punchInUtc,
      break1OutUtc,
      break1InUtc,
      lunchOutUtc,
      lunchInUtc,
      break2OutUtc,
      break2InUtc,
      outUtc: punchOutUtc,
    };
    const c = computeDay(workDate, shift, punches);
    scheduledSeconds = c.scheduledSeconds;
    // Unpaid/non-punched statuses (ABSENT, LEAVE, ...) keep schedule only —
    // punch-variance notes would wrongly flag a day nobody was expected to punch.
    if (PUNCHED.includes(status as Status) || incomplete) {
      workedSeconds = c.workedSeconds;
      lateSeconds = c.lateSeconds;
      undertimeSeconds = c.undertimeSeconds;
      otSeconds = c.otWorkedSeconds;
      nightSeconds = c.nightSeconds;
      nightOtSeconds = c.nightOtSeconds;
      paidBreakSeconds = c.paidBreakSeconds;
      computedNote = c.reviewNote;
    }
  } else {
    // No shift assigned — legacy in/out math against the manual schedule hours.
    const startMs = utcAt(workDate, `${String(START_HOUR).padStart(2, "0")}:00`);
    const hasIn = inMs !== null;
    if (hasIn && times.punchOut) {
      let outMs = utcAt(workDate, times.punchOut);
      if (outMs <= (inMs as number)) outMs += DAY_MS;
      punchOutUtc = new Date(outMs);
      workedSeconds = Math.max(0, Math.round((outMs - (inMs as number)) / 1000));
      lateSeconds = Math.max(0, Math.round(((inMs as number) - startMs) / 1000));
      undertimeSeconds = Math.max(0, scheduledSeconds - workedSeconds);
      otSeconds = Math.max(0, workedSeconds - scheduledSeconds);
      nightSeconds = nightOverlapSeconds(inMs as number, outMs);
      if (otSeconds > 0) {
        nightOtSeconds = nightOverlapSeconds(
          Math.max(startMs + scheduledSeconds * 1000, inMs as number),
          outMs,
        );
      }
    }
  }

  const dayAnchorMs = utcAt(workDate, "12:00");
  const dow = manilaDayOfWeek(dayAnchorMs);
  const isRestDay = emp.weeklyRestDays.includes(dow);

  const holiday = await db
    .select()
    .from(holidayCalendar)
    .where(eq(holidayCalendar.holidayDate, workDate))
    .limit(1);

  const prevDate = new Date(Date.parse(`${workDate}T00:00:00Z`) - DAY_MS)
    .toISOString()
    .slice(0, 10);
  const prev = await db
    .select({ status: attendanceDay.status })
    .from(attendanceDay)
    .where(and(eq(attendanceDay.employeeId, employeeId as number), eq(attendanceDay.workDate, prevDate)))
    .limit(1);
  const presenceBeforeHoliday =
    prev.length === 0 || !UNPAID.includes(prev[0].status as Status);

  const values = {
    employeeId: employeeId as number,
    workDate,
    status: status as Status,
    source: "MANUAL" as const,
    punchInUtc,
    break1OutUtc,
    break1InUtc,
    lunchOutUtc,
    lunchInUtc,
    break2OutUtc,
    break2InUtc,
    punchOutUtc,
    scheduleId: shift?.id ?? null,
    scheduledSeconds,
    workedSeconds,
    paidBreakSeconds,
    lateSeconds,
    undertimeSeconds,
    absentSeconds: needsPunch || incomplete ? 0 : scheduledSeconds,
    otWorkedSeconds: otSeconds,
    otApprovedSeconds: otSeconds,
    nightSeconds,
    nightOtSeconds,
    isRestDay,
    holidayId: holiday[0]?.id ?? null,
    holidayKind: holiday[0]?.kind ?? "NONE",
    presenceBeforeHoliday,
    needsReview: incomplete || computedNote !== null,
    reviewNote: incomplete ? "One side of the punch pair is missing." : computedNote,
    ruleVersion: RULE_VERSION,
    computedAt: new Date(),
  };

  await db
    .insert(attendanceDay)
    .values(values)
    .onConflictDoUpdate({
      target: [attendanceDay.employeeId, attendanceDay.workDate],
      set: values,
    });

  revalidatePath("/attendance");
  return null;
}
