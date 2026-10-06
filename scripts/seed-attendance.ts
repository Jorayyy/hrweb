import "../env";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../src/db";
import { attendanceDay, employee, shiftTemplate } from "../src/db/schema";
import { computeDay, type PunchSet } from "../src/lib/attendance/compute";
import { dateRange } from "../src/lib/attendance/review";
import { manilaDateKey, manilaDayOfWeek, manilaToUtc } from "../src/lib/time";

const FROM = "2026-09-01";
const RULE_VERSION = "att-2026.2";
const UNPAID = ["ABSENT", "LWP", "SUSPENDED"];

function rand(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

function int(key: string, min: number, max: number): number {
  return min + Math.floor(rand(key) * (max - min + 1));
}

function at(dateKey: string, minutes: number): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(manilaToUtc(y, m - 1, d, Math.floor(minutes / 60), minutes % 60));
}

function hhmm(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

async function main() {
  const to = manilaDateKey(Date.now());

  await db.insert(shiftTemplate)
    .values({
      code: "DAY8",
      name: "Day shift 08:00-17:00",
      startsAt: "08:00",
      endsAt: "17:00",
      lunchStart: "12:00",
      lunchEnd: "13:00",
    })
    .onConflictDoNothing();
  const [day8] = await db
    .select()
    .from(shiftTemplate)
    .where(eq(shiftTemplate.code, "DAY8"))
    .limit(1);
  if (!day8) throw new Error("DAY8 shift not found");

  const emps = await db
    .select({
      id: employee.id,
      employeeNo: employee.employeeNo,
      dateHired: employee.dateHired,
      weeklyRestDays: employee.weeklyRestDays,
    })
    .from(employee)
    .where(and(inArray(employee.status, ["ACTIVE", "ON_LEAVE"]), isNull(employee.shiftTemplateId)))
    .orderBy(asc(employee.employeeNo));
  await db.update(employee).set({ shiftTemplateId: day8.id }).where(inArray(employee.id, emps.map((e) => e.id)));

  const all = await db
    .select({
      id: employee.id,
      employeeNo: employee.employeeNo,
      dateHired: employee.dateHired,
      weeklyRestDays: employee.weeklyRestDays,
    })
    .from(employee)
    .where(inArray(employee.status, ["ACTIVE", "ON_LEAVE"]))
    .orderBy(asc(employee.employeeNo));
  if (all.length === 0) throw new Error("no ACTIVE/ON_LEAVE employees");

  await db.delete(attendanceDay);

  const start = hhmm(day8.startsAt);
  const end = hhmm(day8.endsAt);
  const lunchOut = hhmm(day8.lunchStart);
  const lunchIn = hhmm(day8.lunchEnd);

  const stats = { present: 0, absent: 0, incomplete: 0, ot: 0, late: 0, undertime: 0, rest: 0 };
  const prevByEmp = new Map<number, { date: string; status: string }>();
  const rows: (typeof attendanceDay.$inferInsert)[] = [];

  for (const emp of all) {
    for (const workDate of dateRange(FROM, to)) {
      if (workDate < emp.dateHired) continue;
      const dow = manilaDayOfWeek(Date.parse(`${workDate}T04:00:00Z`));
      if (emp.weeklyRestDays.includes(dow)) {
        stats.rest += 1;
        continue;
      }

      const key = `${emp.id}|${workDate}`;
      const prev = prevByEmp.get(emp.id);
      const prevDate = new Date(Date.parse(`${workDate}T00:00:00Z`) - 86_400_000)
        .toISOString()
        .slice(0, 10);
      const presenceBeforeHoliday =
        !prev || prev.date !== prevDate || !UNPAID.includes(prev.status);

      let status: "PRESENT" | "ABSENT" | "INCOMPLETE_PUNCH" | "HOLIDAY_UNWORKED" = "PRESENT";
      let punches: PunchSet = {
        inUtc: null,
        break1OutUtc: null,
        break1InUtc: null,
        lunchOutUtc: null,
        lunchInUtc: null,
        break2OutUtc: null,
        break2InUtc: null,
        outUtc: null,
      };

      if (rand(`${key}|a`) < 0.03) {
        status = "ABSENT";
      } else {
        const late = rand(`${key}|l`);
        const lateMin =
          late < 0.55 ? -int(`${key}|e`, 0, 3) : late < 0.85 ? int(`${key}|s1`, 3, 12) : late < 0.97 ? int(`${key}|s2`, 13, 25) : int(`${key}|s3`, 30, 45);
        const otRoll = rand(`${key}|o`);
        const otMin = otRoll < 0.6 ? 0 : otRoll < 0.84 ? 30 : otRoll < 0.95 ? 60 : 90;
        const outMin =
          otMin > 0
            ? end + otMin
            : rand(`${key}|u`) < 0.1
              ? end - int(`${key}|u2`, 8, 15)
              : end;
        const incomplete = rand(`${key}|p`) < 0.012;
        if (incomplete) status = "INCOMPLETE_PUNCH";
        punches = {
          inUtc: at(workDate, start + lateMin),
          break1OutUtc: null,
          break1InUtc: null,
          lunchOutUtc: at(workDate, lunchOut),
          lunchInUtc: at(workDate, lunchIn),
          break2OutUtc: null,
          break2InUtc: null,
          outUtc: incomplete ? null : at(workDate, outMin),
        };
      }

      const c = computeDay(workDate, day8, punches);
      const punched = status === "PRESENT" || status === "INCOMPLETE_PUNCH";
      const values: typeof attendanceDay.$inferInsert = {
        employeeId: emp.id,
        workDate,
        status,
        source: punched ? "DEVICE" : "MANUAL",
        scheduleId: day8.id,
        punchInUtc: punches.inUtc,
        break1OutUtc: null,
        break1InUtc: null,
        lunchOutUtc: punches.lunchOutUtc,
        lunchInUtc: punches.lunchInUtc,
        break2OutUtc: null,
        break2InUtc: null,
        punchOutUtc: punches.outUtc,
        scheduledSeconds: c.scheduledSeconds,
        workedSeconds: punched ? c.workedSeconds : 0,
        paidBreakSeconds: punched ? c.paidBreakSeconds : 0,
        lateSeconds: punched ? c.lateSeconds : 0,
        undertimeSeconds: punched ? c.undertimeSeconds : 0,
        absentSeconds: status === "ABSENT" ? c.scheduledSeconds : 0,
        otWorkedSeconds: punched ? c.otWorkedSeconds : 0,
        otApprovedSeconds: punched ? c.otWorkedSeconds : 0,
        nightSeconds: punched ? c.nightSeconds : 0,
        nightOtSeconds: punched ? c.nightOtSeconds : 0,
        isRestDay: false,
        holidayId: null,
        holidayKind: "NONE",
        presenceBeforeHoliday,
        needsReview: status === "INCOMPLETE_PUNCH",
        reviewNote: status === "INCOMPLETE_PUNCH" ? "Missing punch out" : null,
        ruleVersion: RULE_VERSION,
        computedAt: new Date(),
      };
      rows.push(values);
      prevByEmp.set(emp.id, { date: workDate, status });

      if (status === "PRESENT") stats.present += 1;
      else if (status === "ABSENT") stats.absent += 1;
      else stats.incomplete += 1;
      if (punched && c.otWorkedSeconds > 0) stats.ot += 1;
      if (punched && c.lateSeconds > 0) stats.late += 1;
      if (punched && c.undertimeSeconds > 0) stats.undertime += 1;
    }
  }

  for (let i = 0; i < rows.length; i += 400) {
    await db.insert(attendanceDay).values(rows.slice(i, i + 400));
  }

  console.log({ from: FROM, to, employees: all.length, rows: rows.length, ...stats });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
