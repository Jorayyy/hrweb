import "../env";
import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "../src/db";
import { attendanceDay, employee, holidayCalendar, shiftTemplate } from "../src/db/schema";
import { computeDay, type PunchSet } from "../src/lib/attendance/compute";
import { manilaDayOfWeek, manilaToUtc } from "../src/lib/time";

const EMPLOYEE_NO = "E-0033";
const RULE_VERSION = "att-2026.2";
const FROM = "2026-09-01";
const TO = "2026-10-04";

const ABSENT_DAYS = new Set(["2026-09-15"]);
const HALF_DAYS = new Map([["2026-09-22", ["08:00", "12:00"] as const]]);
const LATE_DAYS = new Map([["2026-09-09", "08:19"]]);
const OT_DAYS = new Map([["2026-09-30", "19:30"]]);

function punchAt(workDate: string, hhmm: string): Date {
  const [y, m, d] = workDate.split("-").map(Number);
  const [h, min] = hhmm.split(":").map(Number);
  return new Date(manilaToUtc(y, m - 1, d, h, min));
}

function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  let cursor = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  while (cursor <= end) {
    out.push(new Date(cursor).toISOString().slice(0, 10));
    cursor += 86_400_000;
  }
  return out;
}

async function main() {
  const [emp] = await db
    .select({ id: employee.id })
    .from(employee)
    .where(eq(employee.employeeNo, EMPLOYEE_NO))
    .limit(1);
  if (!emp) throw new Error(`employee ${EMPLOYEE_NO} not found — run db:seed:org first`);
  const EMP_ID = emp.id;

  await db
    .insert(shiftTemplate)
    .values({
      code: "DAY8",
      name: "Day shift 08:00-17:00",
      startsAt: "08:00",
      endsAt: "17:00",
      lunchStart: "12:00",
      lunchEnd: "13:00",
    })
    .onConflictDoNothing();

  const [shift] = await db.select().from(shiftTemplate).where(eq(shiftTemplate.code, "DAY8")).limit(1);
  if (!shift) throw new Error("DAY8 shift not found");

  await db
    .update(employee)
    .set({ shiftTemplateId: shift.id })
    .where(eq(employee.id, EMP_ID));

  const holidays = new Map(
    (
      await db
        .select()
        .from(holidayCalendar)
        .where(and(gte(holidayCalendar.holidayDate, FROM), lte(holidayCalendar.holidayDate, TO)))
    ).map((h) => [h.holidayDate, h]),
  );

  const shiftInput = {
    startsAt: shift.startsAt,
    endsAt: shift.endsAt,
    break1Start: shift.break1Start,
    break1End: shift.break1End,
    lunchStart: shift.lunchStart,
    lunchEnd: shift.lunchEnd,
    break2Start: shift.break2Start,
    break2End: shift.break2End,
  };

  let inserted = 0;
  let skippedRest = 0;

  for (const workDate of dateRange(FROM, TO)) {
    const dow = manilaDayOfWeek(Date.parse(`${workDate}T04:00:00Z`)); // Manila noon anchor
    if (dow === 6) {
      skippedRest += 1;
      continue;
    }

    const prevDate = new Date(Date.parse(`${workDate}T00:00:00Z`) - 86_400_000)
      .toISOString()
      .slice(0, 10);
    const [prev] = await db
      .select({ status: attendanceDay.status })
      .from(attendanceDay)
      .where(and(eq(attendanceDay.employeeId, EMP_ID), eq(attendanceDay.workDate, prevDate)))
      .limit(1);

    const holiday = holidays.get(workDate) ?? null;
    const base = {
      employeeId: EMP_ID,
      workDate,
      source: "MANUAL" as const,
      scheduleId: shift.id,
      isRestDay: false,
      holidayId: holiday?.id ?? null,
      holidayKind: holiday?.kind ?? ("NONE" as const),
      presenceBeforeHoliday: !prev || prev.status !== "ABSENT" && prev.status !== "LWP" && prev.status !== "SUSPENDED",
      ruleVersion: RULE_VERSION,
      computedAt: new Date(),
    };

    if (ABSENT_DAYS.has(workDate)) {
      await db
        .insert(attendanceDay)
        .values({
          ...base,
          status: "ABSENT",
          scheduledSeconds: 8 * 3600,
          absentSeconds: 8 * 3600,
        })
        .onConflictDoUpdate({
          target: [attendanceDay.employeeId, attendanceDay.workDate],
          set: { status: "ABSENT", scheduledSeconds: 8 * 3600, absentSeconds: 8 * 3600, computedAt: new Date() },
        });
      inserted += 1;
      continue;
    }

    const half = HALF_DAYS.get(workDate);
    const inHhmm = LATE_DAYS.get(workDate) ?? (half ? half[0] : "08:02");
    const outHhmm = half ? half[1] : (OT_DAYS.get(workDate) ?? "17:01");

    const punches: PunchSet = {
      inUtc: punchAt(workDate, inHhmm),
      break1OutUtc: null,
      break1InUtc: null,
      lunchOutUtc: half ? null : punchAt(workDate, "12:00"),
      lunchInUtc: half ? null : punchAt(workDate, "13:00"),
      break2OutUtc: null,
      break2InUtc: null,
      outUtc: punchAt(workDate, outHhmm),
    };

    const c = computeDay(workDate, shiftInput, punches);
    const status: "HALF_DAY" | "PRESENT" = half ? "HALF_DAY" : "PRESENT";

    const values = {
      ...base,
      status,
      punchInUtc: punches.inUtc,
      punchOutUtc: punches.outUtc,
      lunchOutUtc: punches.lunchOutUtc,
      lunchInUtc: punches.lunchInUtc,
      scheduledSeconds: c.scheduledSeconds,
      workedSeconds: c.workedSeconds,
      paidBreakSeconds: c.paidBreakSeconds,
      lateSeconds: c.lateSeconds,
      undertimeSeconds: c.undertimeSeconds,
      absentSeconds: 0,
      otWorkedSeconds: c.otWorkedSeconds,
      otApprovedSeconds: c.otWorkedSeconds,
      nightSeconds: c.nightSeconds,
      nightOtSeconds: c.nightOtSeconds,
      needsReview: c.needsReview,
      reviewNote: c.reviewNote,
    };

    await db
      .insert(attendanceDay)
      .values(values)
      .onConflictDoUpdate({
        target: [attendanceDay.employeeId, attendanceDay.workDate],
        set: values,
      });
    inserted += 1;
  }

  console.log(`seeded ${inserted} attendance days for employee ${EMP_ID} (${skippedRest} rest days skipped)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
