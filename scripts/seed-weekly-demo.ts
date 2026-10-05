import "../env";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "../src/db";
import {
  attendanceDay,
  employee,
  holidayCalendar,
  payrollPeriod,
  shiftTemplate,
  users,
} from "../src/db/schema";
import { computeDay, type PunchSet } from "../src/lib/attendance/compute";
import { hashPassword } from "../src/lib/password";
import { manilaDayOfWeek, manilaToUtc } from "../src/lib/time";

const WEEK_FROM = "2026-09-28";
const WEEK_TO = "2026-10-04";
const PAY_DATE = "2026-10-11";
const PERIOD_CODE = "2026-W40";
const RULE_VERSION = "att-2026.2";

function at(dateKey: string, hhmm: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
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
  const [shift] = await db
    .select()
    .from(shiftTemplate)
    .where(eq(shiftTemplate.code, "DAY8"))
    .limit(1);
  if (!shift) throw new Error("DAY8 shift not found");

  const emps = await db
    .select({
      id: employee.id,
      employeeNo: employee.employeeNo,
      weeklyRestDays: employee.weeklyRestDays,
      shiftTemplateId: employee.shiftTemplateId,
    })
    .from(employee)
    .where(
      and(
        eq(employee.status, "ACTIVE"),
        inArray(employee.payFrequency, ["WEEKLY", "DAILY"]),
      ),
    )
    .orderBy(asc(employee.employeeNo));
  if (emps.length === 0) throw new Error("no WEEKLY/DAILY ACTIVE employees");

  const ids = emps.map((e) => e.id);
  await db
    .update(employee)
    .set({ shiftTemplateId: shift.id })
    .where(inArray(employee.id, ids));

  const holidays = new Map(
    (
      await db
        .select()
        .from(holidayCalendar)
        .where(
          and(
            gte(holidayCalendar.holidayDate, WEEK_FROM),
            lte(holidayCalendar.holidayDate, WEEK_TO),
          ),
        )
    ).map((h) => [h.holidayDate, h]),
  );

  let written = 0;
  let skippedRest = 0;
  for (const emp of emps) {
    for (const workDate of dateRange(WEEK_FROM, WEEK_TO)) {
      const dow = manilaDayOfWeek(Date.parse(`${workDate}T04:00:00Z`));
      if (emp.weeklyRestDays.includes(dow)) {
        skippedRest += 1;
        continue;
      }

      const punches: PunchSet = {
        inUtc: at(workDate, "08:00"),
        break1OutUtc: null,
        break1InUtc: null,
        lunchOutUtc: at(workDate, "12:00"),
        lunchInUtc: at(workDate, "13:00"),
        break2OutUtc: null,
        break2InUtc: null,
        outUtc: at(workDate, "17:00"),
      };
      const c = computeDay(workDate, shift, punches);

      const prevDate = new Date(Date.parse(`${workDate}T00:00:00Z`) - 86_400_000)
        .toISOString()
        .slice(0, 10);
      const [prev] = await db
        .select({ status: attendanceDay.status })
        .from(attendanceDay)
        .where(
          and(
            eq(attendanceDay.employeeId, emp.id),
            eq(attendanceDay.workDate, prevDate),
          ),
        )
        .limit(1);
      const holiday = holidays.get(workDate) ?? null;

      const values = {
        employeeId: emp.id,
        workDate,
        status: (c.complete ? "PRESENT" : "INCOMPLETE_PUNCH") as
          | "PRESENT"
          | "INCOMPLETE_PUNCH",
        source: "MANUAL" as const,
        scheduleId: shift.id,
        punchInUtc: punches.inUtc,
        break1OutUtc: null,
        break1InUtc: null,
        lunchOutUtc: punches.lunchOutUtc,
        lunchInUtc: punches.lunchInUtc,
        break2OutUtc: null,
        break2InUtc: null,
        punchOutUtc: punches.outUtc,
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
        isRestDay: false,
        holidayId: holiday?.id ?? null,
        holidayKind: holiday?.kind ?? ("NONE" as const),
        presenceBeforeHoliday:
          !prev || (prev.status !== "ABSENT" && prev.status !== "LWP" && prev.status !== "SUSPENDED"),
        needsReview: c.needsReview,
        reviewNote: c.reviewNote,
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
      written += 1;
    }
  }

  await db
    .insert(payrollPeriod)
    .values({
      periodCode: PERIOD_CODE,
      dateFrom: WEEK_FROM,
      dateTo: WEEK_TO,
      cutoffAt: new Date(manilaToUtc(2026, 9, 4, 23, 59)),
      payDate: PAY_DATE,
      frequency: "WEEKLY",
    })
    .onConflictDoNothing();

  const [payrollUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "payroll@hrweb.local"))
    .limit(1);
  if (payrollUser) {
    await db
      .update(users)
      .set({ passwordHash: await hashPassword("employee123") })
      .where(eq(users.id, payrollUser.id));
  }

  const flagged = await db
    .select({ n: attendanceDay.needsReview })
    .from(attendanceDay)
    .where(
      and(
        inArray(attendanceDay.employeeId, ids),
        gte(attendanceDay.workDate, WEEK_FROM),
        lte(attendanceDay.workDate, WEEK_TO),
      ),
    );
  console.log({
    flippedToWeekly: emps.map((e) => e.employeeNo),
    attendanceRows: written,
    skippedRestDays: skippedRest,
    period: PERIOD_CODE,
    payrollUserReset: Boolean(payrollUser),
    flaggedRows: flagged.filter((f) => f.n).length,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
