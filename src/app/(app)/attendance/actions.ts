"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { attendanceDay, attendanceStatus, employee, holidayCalendar } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { field, isIsoDate, oneOf, type FormState } from "@/lib/form";
import { manilaDateKey, manilaDayOfWeek, manilaToUtc, nightOverlapSeconds } from "@/lib/time";

const RULE_VERSION = "att-2026.1";
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

export async function saveAttendanceDay(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("ADMIN", "HR");

  const employeeId = Number(field(formData, "employeeId")) || null;
  const workDate = field(formData, "workDate");
  const status = field(formData, "status");
  const punchIn = field(formData, "punchIn");
  const punchOut = field(formData, "punchOut");
  const hoursRaw = Number(field(formData, "scheduledHours") || "8");

  const errors: Record<string, string> = {};
  if (!employeeId) errors.employeeId = "Employee is required.";
  if (!isIsoDate(workDate)) errors.workDate = "A valid date is required.";
  if (!oneOf(status, attendanceStatus.enumValues)) errors.status = "Unknown status.";
  if (!Number.isFinite(hoursRaw) || hoursRaw <= 0 || hoursRaw > 24)
    errors.scheduledHours = "Hours must be between 0 and 24.";
  const needsPunch = oneOf(status, attendanceStatus.enumValues) && PUNCHED.includes(status as Status);
  if (needsPunch) {
    if (!TIME.test(punchIn) || !TIME.test(punchOut)) {
      errors.punchIn = "Punch in and out are required for this status.";
    }
  }
  if (!needsPunch && status !== "INCOMPLETE_PUNCH") {
    if (punchIn && !TIME.test(punchIn)) errors.punchIn = "Use HH:MM.";
    if (punchOut && !TIME.test(punchOut)) errors.punchOut = "Use HH:MM.";
  }
  if (Object.keys(errors).length > 0) return { errors };

  const emp = await db
    .select({ id: employee.id, weeklyRestDays: employee.weeklyRestDays })
    .from(employee)
    .where(eq(employee.id, employeeId as number))
    .limit(1);
  if (emp.length === 0) return { errors: { employeeId: "Employee not found." } };

  const scheduledSeconds = Math.round(hoursRaw * 3600);
  const startMs = utcAt(workDate, `${String(START_HOUR).padStart(2, "0")}:00`);

  let punchInUtc: Date | null = null;
  let punchOutUtc: Date | null = null;
  let workedSeconds = 0;
  let lateSeconds = 0;
  let undertimeSeconds = 0;
  let otSeconds = 0;
  let nightSeconds = 0;
  let nightOtSeconds = 0;

  const hasIn = TIME.test(punchIn);
  const hasOut = TIME.test(punchOut);

  if (hasIn) {
    const inMs = utcAt(workDate, punchIn);
    let outMs = hasOut ? utcAt(workDate, punchOut) : 0;
    if (hasOut && outMs <= inMs) outMs += DAY_MS;

    punchInUtc = new Date(inMs);
    if (hasOut) {
      punchOutUtc = new Date(outMs);
      workedSeconds = Math.max(0, Math.round((outMs - inMs) / 1000));
      lateSeconds = Math.max(0, Math.round((inMs - startMs) / 1000));
      undertimeSeconds = Math.max(0, scheduledSeconds - workedSeconds);
      otSeconds = Math.max(0, workedSeconds - scheduledSeconds);
      nightSeconds = nightOverlapSeconds(inMs, outMs);
      if (otSeconds > 0) {
        nightOtSeconds = nightOverlapSeconds(Math.max(startMs + scheduledSeconds * 1000, inMs), outMs);
      }
    }
  }

  const dow = manilaDayOfWeek(startMs);
  const isRestDay = emp[0].weeklyRestDays.includes(dow);

  const holiday = await db
    .select()
    .from(holidayCalendar)
    .where(eq(holidayCalendar.holidayDate, workDate))
    .limit(1);

  const prevDate = manilaDateKey(Date.parse(`${workDate}T00:00:00Z`) - DAY_MS);
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
    punchOutUtc,
    scheduledSeconds,
    workedSeconds,
    paidBreakSeconds: 0,
    lateSeconds,
    undertimeSeconds,
    absentSeconds: needsPunch || status === "INCOMPLETE_PUNCH" ? 0 : scheduledSeconds,
    otWorkedSeconds: otSeconds,
    otApprovedSeconds: otSeconds,
    nightSeconds,
    nightOtSeconds,
    isRestDay,
    holidayId: holiday[0]?.id ?? null,
    holidayKind: holiday[0]?.kind ?? "NONE",
    presenceBeforeHoliday,
    needsReview: status === "INCOMPLETE_PUNCH",
    reviewNote: status === "INCOMPLETE_PUNCH" ? "One side of the punch pair is missing." : null,
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
