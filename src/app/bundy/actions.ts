"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { attendanceDay, employee, holidayCalendar, shiftTemplate } from "@/db/schema";
import { computeDay, type PunchSet } from "@/lib/attendance/compute";
import { clientIp, isBundyIpAllowed } from "@/lib/bundy";
import { field, type FormState } from "@/lib/form";
import { verifyPassword } from "@/lib/password";
import { MANILA_OFFSET_MS, manilaDateKey, manilaDayOfWeek } from "@/lib/time";

const RULE_VERSION = "att-2026.2";
const DAY_MS = 86_400_000;

const SLOTS = [
  "in",
  "break1Out",
  "break1In",
  "lunchOut",
  "lunchIn",
  "break2Out",
  "break2In",
  "out",
] as const;
type Slot = (typeof SLOTS)[number];

const SLOT_LABEL: Record<Slot, string> = {
  in: "In",
  break1Out: "1st Break Out",
  break1In: "1st Break In",
  lunchOut: "Lunch Out",
  lunchIn: "Lunch In",
  break2Out: "2nd Break Out",
  break2In: "2nd Break In",
  out: "Out",
};

const PREREQ: Record<Slot, Slot | null> = {
  in: null,
  out: "in",
  break1Out: "in",
  break1In: "break1Out",
  lunchOut: "in",
  lunchIn: "lunchOut",
  break2Out: "in",
  break2In: "break2Out",
};

const UNPAID = ["ABSENT", "NOT_SCHEDULED", "HOLIDAY_UNWORKED", "LWP", "SUSPENDED"];

const pad = (n: number) => String(n).padStart(2, "0");

function manilaStamp(ms: number): string {
  const d = new Date(ms + MANILA_OFFSET_MS);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

type DayRow = typeof attendanceDay.$inferSelect;
type ShiftRow = typeof shiftTemplate.$inferSelect;

function slotEnabled(slot: Slot, shift: ShiftRow): boolean {
  if (slot.startsWith("break1")) return shift.break1Start !== null;
  if (slot.startsWith("break2")) return shift.break2Start !== null;
  return true;
}

function slotTime(row: DayRow | undefined, slot: Slot): Date | null {
  if (!row) return null;
  switch (slot) {
    case "in":
      return row.punchInUtc;
    case "break1Out":
      return row.break1OutUtc;
    case "break1In":
      return row.break1InUtc;
    case "lunchOut":
      return row.lunchOutUtc;
    case "lunchIn":
      return row.lunchInUtc;
    case "break2Out":
      return row.break2OutUtc;
    case "break2In":
      return row.break2InUtc;
    case "out":
      return row.punchOutUtc;
  }
}

function slotValues(slot: Slot, now: Date): Partial<DayRow> {
  switch (slot) {
    case "in":
      return { punchInUtc: now };
    case "break1Out":
      return { break1OutUtc: now };
    case "break1In":
      return { break1InUtc: now };
    case "lunchOut":
      return { lunchOutUtc: now };
    case "lunchIn":
      return { lunchInUtc: now };
    case "break2Out":
      return { break2OutUtc: now };
    case "break2In":
      return { break2InUtc: now };
    case "out":
      return { punchOutUtc: now };
  }
}

function punchSet(row: DayRow | undefined, slot: Slot, now: Date): PunchSet {
  const pick = (col: Date | null, s: Slot): Date | null => (s === slot ? now : col);
  return {
    inUtc: pick(row?.punchInUtc ?? null, "in"),
    break1OutUtc: pick(row?.break1OutUtc ?? null, "break1Out"),
    break1InUtc: pick(row?.break1InUtc ?? null, "break1In"),
    lunchOutUtc: pick(row?.lunchOutUtc ?? null, "lunchOut"),
    lunchInUtc: pick(row?.lunchInUtc ?? null, "lunchIn"),
    break2OutUtc: pick(row?.break2OutUtc ?? null, "break2Out"),
    break2InUtc: pick(row?.break2InUtc ?? null, "break2In"),
    outUtc: pick(row?.punchOutUtc ?? null, "out"),
  };
}

export async function punch(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = clientIp(await headers());
  if (!(await isBundyIpAllowed(ip))) {
    return { error: "This device is not authorized to record punches." };
  }

  const rawSlot = field(formData, "slot");
  const slot = SLOTS.find((s) => s === rawSlot);
  if (!slot) return { error: "Choose a punch to record." };

  const employeeNo = field(formData, "employeeNo");
  const pin = field(formData, "pin");
  if (!employeeNo || !pin) return { error: "Employee no. and PIN are required." };

  const [emp] = await db
    .select({
      id: employee.id,
      status: employee.status,
      bundyPin: employee.bundyPin,
      weeklyRestDays: employee.weeklyRestDays,
      shiftTemplateId: employee.shiftTemplateId,
    })
    .from(employee)
    .where(eq(employee.employeeNo, employeeNo))
    .limit(1);

  if (!emp || !emp.bundyPin || !(await verifyPassword(pin, emp.bundyPin))) {
    return { error: "Employee no. or PIN is incorrect." };
  }
  if (emp.status !== "ACTIVE" && emp.status !== "ON_LEAVE") {
    return { error: "This employee is not active." };
  }
  if (!emp.shiftTemplateId) {
    return { error: "No shift schedule assigned — see HR before punching." };
  }

  const [shift] = await db
    .select()
    .from(shiftTemplate)
    .where(eq(shiftTemplate.id, emp.shiftTemplateId))
    .limit(1);
  if (!shift) return { error: "Assigned shift not found — see HR." };
  if (!slotEnabled(slot, shift)) {
    const name = slot.startsWith("break1") ? "1st break" : "2nd break";
    return { error: `Your shift has no ${name} — punch In or Out instead.` };
  }

  const now = Date.now();
  const nowUtc = new Date(now);
  const workDate = manilaDateKey(now);

  const [row] = await db
    .select()
    .from(attendanceDay)
    .where(and(eq(attendanceDay.employeeId, emp.id), eq(attendanceDay.workDate, workDate)))
    .limit(1);

  const existing = slotTime(row, slot);
  if (existing) {
    return { error: `${SLOT_LABEL[slot]} was already recorded at ${manilaStamp(existing.getTime())}.` };
  }
  const req = PREREQ[slot];
  if (req && !slotTime(row, req)) {
    return { error: `Record your ${SLOT_LABEL[req]} punch first.` };
  }

  const computed = computeDay(workDate, shift, punchSet(row, slot, nowUtc));
  const isRestDay = emp.weeklyRestDays.includes(manilaDayOfWeek(now));
  const aggregates = {
    scheduledSeconds: computed.scheduledSeconds,
    workedSeconds: computed.workedSeconds,
    paidBreakSeconds: computed.paidBreakSeconds,
    lateSeconds: computed.lateSeconds,
    undertimeSeconds: computed.undertimeSeconds,
    otWorkedSeconds: computed.otWorkedSeconds,
    nightSeconds: computed.nightSeconds,
    needsReview: computed.needsReview,
    reviewNote: computed.reviewNote,
    scheduleId: shift.id,
    source: "DEVICE" as const,
    ruleVersion: RULE_VERSION,
    computedAt: nowUtc,
    absentSeconds: 0,
    status: computed.complete
      ? isRestDay
        ? ("REST_DAY_WORKED" as const)
        : ("PRESENT" as const)
      : ("INCOMPLETE_PUNCH" as const),
  };

  if (row) {
    await db
      .update(attendanceDay)
      .set({ ...slotValues(slot, nowUtc), ...aggregates })
      .where(
        and(eq(attendanceDay.employeeId, emp.id), eq(attendanceDay.workDate, workDate)),
      );
  } else {
    const holiday = await db
      .select()
      .from(holidayCalendar)
      .where(eq(holidayCalendar.holidayDate, workDate))
      .limit(1);
    const prevDate = manilaDateKey(Date.parse(`${workDate}T00:00:00Z`) - DAY_MS);
    const [prev] = await db
      .select({ status: attendanceDay.status })
      .from(attendanceDay)
      .where(and(eq(attendanceDay.employeeId, emp.id), eq(attendanceDay.workDate, prevDate)))
      .limit(1);

    await db.insert(attendanceDay).values({
      employeeId: emp.id,
      workDate,
      ...slotValues(slot, nowUtc),
      ...aggregates,
      isRestDay,
      holidayId: holiday[0]?.id ?? null,
      holidayKind: holiday[0]?.kind ?? "NONE",
      presenceBeforeHoliday: !prev || !UNPAID.includes(prev.status),
    });
  }

  const next = SLOTS.find((s) => s !== slot && slotEnabled(s, shift) && !slotTime(row, s));

  return {
    message: next
      ? `${SLOT_LABEL[slot]} recorded at ${manilaStamp(now)}. Next: ${SLOT_LABEL[next]}.`
      : `${SLOT_LABEL[slot]} recorded at ${manilaStamp(now)}. Shift complete for today.`,
  };
}
