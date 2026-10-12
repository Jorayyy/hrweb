import "../env";
import { and, desc, eq, gte, inArray, isNull, lt, lte, ne, or } from "drizzle-orm";
import { db } from "../src/db";
import {
  announcement,
  attendanceDay,
  birTaxTable,
  campaign,
  costCenter,
  department,
  employee,
  employeeCompensationHistory,
  holidayCalendar,
  hdmfSchedule,
  jobPosition,
  leaveRequest,
  leaveType,
  payrollJob,
  payrollPeriod,
  payrollRun,
  payrollRunItem,
  phicSchedule,
  premiumMatrix,
  shiftTemplate,
  sssSchedule,
  users,
} from "../src/db/schema";
import { computeDay, type PunchSet } from "../src/lib/attendance/compute";
import { hashPassword } from "../src/lib/password";
import { isoWeek, manilaDateKey, manilaDayOfWeek, manilaToUtc } from "../src/lib/time";
import {
  calcEmployee,
  type DayInput,
  type EmployeeInput,
  type StatConfig,
} from "../src/app/(app)/payroll/calc";
import type { PayFrequency, PremiumRow } from "../src/lib/statutory/ph";

const DEMO_PASSWORD = "employee123";
const RULE_VERSION = "att-2026.3";
const PAYRULE_VERSION = "pay-2026.1";
const DAY_MS = 86_400_000;
const WEEKS_OF_HISTORY = 3;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261012);
const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];
const between = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

/** Key-hashed rand so attendance rolls are stable per (employee, date, field). */
function srand(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}
function sint(key: string, min: number, max: number): number {
  return min + Math.floor(srand(key) * (max - min + 1));
}
const round500 = (v: number) => Math.round(v / 500) * 500;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const addDays = (date: string, days: number) => iso(Date.parse(date) + days * DAY_MS);
const pad = (n: number) => String(n).padStart(2, "0");

function at(dateKey: string, minutes: number): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(manilaToUtc(y, m - 1, d, Math.floor(minutes / 60), minutes % 60));
}
function hhmm(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function digits(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += Math.floor(rand() * 10);
  return out;
}

const FIRST = [
  "Mark", "John", "Christian", "Joshua", "Angelo", "Ryan", "Patrick", "Kevin", "Miguel", "Gabriel",
  "Maria", "Janna", "Kristine", "Angelica", "Rose", "Lovely", "Mariel", "Stephanie", "Grace", "Maureen",
];
const LAST = [
  "Dela Cruz", "Reyes", "Santos", "Garcia", "Mendoza", "Bautista", "Villanueva", "Aquino", "Ramos", "Flores",
  "Gonzales", "Panganiban", "Tolentino", "Mercado", "Salazar", "Domingo", "Cabrera", "Ignacio", "Padilla", "Manalo",
];
const REST_PATTERNS = [[0], [0], [0], [6], [0, 6]] as const;
const RDO = ["029", "030", "040", "050", "093"];

const CREDS: string[] = [];

async function ensureUser(email: string, name: string, role: "EMPLOYEE" | "ADMIN" | "HR" | "PAYROLL" | "OWNER", employeeId?: number) {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    await db
      .update(users)
      .set({ passwordHash: await hashPassword(DEMO_PASSWORD), ...(employeeId ? { employeeId } : {}) })
      .where(eq(users.id, existing.id));
    return existing.id;
  }
  const [created] = await db
    .insert(users)
    .values({
      email,
      name,
      role,
      passwordHash: await hashPassword(DEMO_PASSWORD),
      employeeId: employeeId ?? null,
    })
    .returning({ id: users.id });
  CREDS.push(`${email}  ${DEMO_PASSWORD}`);
  return created.id;
}

async function main() {
  const today = manilaDateKey(Date.now());
  const currentMonday = addDays(today, -((manilaDayOfWeek(Date.now()) + 6) % 7));
  const attendanceFrom = addDays(currentMonday, -7 * WEEKS_OF_HISTORY);

  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.role, ["OWNER", "ADMIN", "HR"]))
    .orderBy(desc(users.createdAt))
    .limit(1);
  const adminId = owner?.id ?? (await ensureUser("demo.admin@hrweb.local", "Dana Admin", "ADMIN"));

  await db.insert(costCenter).values({ code: "CC-OPS", name: "Operations" }).onConflictDoNothing();
  const [cc] = await db.select({ id: costCenter.id }).from(costCenter).where(eq(costCenter.code, "CC-OPS"));
  if (!cc) throw new Error("CC-OPS missing");

  const CAMPAIGNS = [
    { code: "GSEARCH", name: "Google Search", client: "Google", deptCode: "GS", deptName: "Google Search", posCode: "AG-GS", posTitle: "Search Quality Analyst" },
    { code: "TAX", name: "Tax Response", client: "Tax Services", deptCode: "TX", deptName: "Tax Response", posCode: "AG-TX", posTitle: "Tax Processing Associate" },
  ] as const;

  await db
    .insert(campaign)
    .values(CAMPAIGNS.map((c) => ({ code: c.code, name: c.name, clientName: c.client, costCenterId: cc.id })))
    .onConflictDoNothing();
  await db
    .insert(department)
    .values(CAMPAIGNS.map((c) => ({ code: c.deptCode, name: c.deptName, costCenterId: cc.id })))
    .onConflictDoNothing();
  await db
    .insert(jobPosition)
    .values([
      { code: "TL", title: "Team Leader", jobLevel: 3, isManagerial: true },
      ...CAMPAIGNS.map((c) => ({ code: c.posCode, title: c.posTitle, jobLevel: 1, isManagerial: false })),
    ])
    .onConflictDoNothing();
  await db
    .insert(shiftTemplate)
    .values({
      code: "NGT",
      name: "Graveyard 21:00-06:00",
      startsAt: "21:00",
      endsAt: "06:00",
      lunchStart: "01:00",
      lunchEnd: "02:00",
    })
    .onConflictDoNothing();

  const [ngt] = await db.select().from(shiftTemplate).where(eq(shiftTemplate.code, "NGT")).limit(1);
  if (!ngt) throw new Error("NGT shift missing");
  const campRows = await db.select().from(campaign);
  const deptRows = await db.select().from(department);
  const posRows = await db.select().from(jobPosition);
  const campId = new Map(campRows.map((r) => [r.code, r.id]));
  const deptId = new Map(deptRows.map((r) => [r.code, r.id]));
  const posId = new Map(posRows.map((r) => [r.code, r.id]));

  const usedEmails = new Set<string>();
  const rows: (typeof employee.$inferInsert)[] = [];
  const agentUsers: { code: string; email: string; name: string }[] = [];
  let seq = 0;

  for (const [campIdx, camp] of CAMPAIGNS.entries()) {
    for (let i = 0; i < 20; i++) {
      seq += 1;
      const isTL = i === 0;
      const firstName = FIRST[(seq - 1) % FIRST.length];
      const lastName = LAST[(((seq - 1) * 7) + campIdx * 3) % LAST.length];
      const slug = `${firstName}.${lastName}`.toLowerCase().replace(/[^a-z.]/g, "");
      let email = `${slug}@demo.hrweb.local`;
      let suffix = 1;
      while (usedEmails.has(email)) {
        suffix += 1;
        email = `${slug}${suffix}@demo.hrweb.local`;
      }
      usedEmails.add(email);

      const salary = round500(isTL ? between(32000, 36000) : between(18000, 22000)) * 100;
      const employmentType = isTL || rand() < 0.75 ? ("REGULAR" as const) : rand() < 0.6 ? ("PROBATIONARY" as const) : ("PROJECT" as const);
      const dateHired = iso(Date.parse("2023-01-01") + Math.floor(rand() * 1250) * DAY_MS);

      rows.push({
        employeeNo: `${camp.deptCode}-${pad(i + 1).padStart(4, "0")}`,
        externalCode: `${camp.code}${i + 1}`,
        firstName,
        lastName,
        email,
        dateHired,
        dateRegularized: employmentType === "REGULAR" && dateHired <= addDays(today, -180) ? addDays(dateHired, 180) : null,
        status: "ACTIVE",
        employmentType,
        payFrequency: "WEEKLY",
        campaignId: campId.get(camp.code) as number,
        departmentId: deptId.get(camp.deptCode) as number,
        costCenterId: cc.id,
        positionId: posId.get(isTL ? "TL" : camp.posCode) as number,
        baseSalaryMonthly: salary,
        tinNo: [digits(3), digits(3), digits(3), digits(3)].join("-"),
        sssNo: digits(12),
        philhealthNo: digits(12),
        pagibigNo: digits(12),
        rdoCode: pick(RDO),
        isMinimumWageExempt: salary < 1600000,
        isManagerialTaxTbl: isTL,
        weeklyRestDays: [...pick(REST_PATTERNS)],
        shiftTemplateId: ngt.id,
      });

      if (i === 1) agentUsers.push({ code: `${camp.deptCode}-0002`, email, name: `${firstName} ${lastName}` });
    }
  }

  await db.insert(employee).values(rows).onConflictDoNothing();
  const emps = await db
    .select()
    .from(employee)
    .where(and(inArray(employee.status, ["ACTIVE"]), eq(employee.payFrequency, "WEEKLY")));

  const tlByDept = new Map<string, number>();
  for (const camp of CAMPAIGNS) {
    const [tl] = await db
      .select({ id: employee.id })
      .from(employee)
      .where(and(eq(employee.employeeNo, `${camp.deptCode}-0001`)))
      .limit(1);
    if (tl) tlByDept.set(camp.deptCode, tl.id);
  }
  for (const camp of CAMPAIGNS) {
    const tlId = tlByDept.get(camp.deptCode);
    if (!tlId) continue;
    await db
      .update(employee)
      .set({ reportsToId: tlId })
      .where(and(eq(employee.departmentId, deptId.get(camp.deptCode) as number), isNull(employee.reportsToId), ne(employee.id, tlId)));
  }

  const existingComp = new Set(
    (await db.select({ employeeId: employeeCompensationHistory.employeeId }).from(employeeCompensationHistory)).map((r) => r.employeeId),
  );
  const missingComp = emps.filter((e) => !existingComp.has(e.id));
  if (missingComp.length > 0) {
    await db
      .insert(employeeCompensationHistory)
      .values(missingComp.map((e) => ({
        employeeId: e.id,
        baseSalaryMonthly: e.baseSalaryMonthly,
        payFrequency: e.payFrequency,
        effectiveFrom: e.dateHired,
        reason: "HIRE",
      })))
      .onConflictDoNothing();
  }

  for (const a of agentUsers) {
    const [emp] = await db.select({ id: employee.id }).from(employee).where(eq(employee.employeeNo, a.code)).limit(1);
    await ensureUser(a.email, a.name, "EMPLOYEE", emp?.id);
  }

  const holidays = new Map(
    (
      await db
        .select()
        .from(holidayCalendar)
        .where(and(gte(holidayCalendar.holidayDate, attendanceFrom), lte(holidayCalendar.holidayDate, today)))
    ).map((h) => [h.holidayDate, h]),
  );

  const start = hhmm(ngt.startsAt);
  const endNext = 24 * 60 + hhmm(ngt.endsAt);
  const lunchOut = hhmm(ngt.lunchStart);
  const lunchIn = hhmm(ngt.lunchEnd);
  const stats = { present: 0, absent: 0, incomplete: 0, holiday: 0, late: 0, ot: 0 };
  const prevByEmp = new Map<number, { date: string; status: string }>();
  const attRows: (typeof attendanceDay.$inferInsert)[] = [];

  for (const emp of emps) {
    for (let d = Date.parse(attendanceFrom); d <= Date.parse(today); d += DAY_MS) {
      const workDate = iso(d);
      if (workDate < emp.dateHired) continue;
      const dow = manilaDayOfWeek(Date.parse(`${workDate}T04:00:00Z`));
      if (emp.weeklyRestDays.includes(dow)) continue;

      const key = `${emp.employeeNo}|${workDate}`;
      const prevDate = addDays(workDate, -1);
      const prev = prevByEmp.get(emp.id);
      const presenceBeforeHoliday = !prev || prev.date !== prevDate || (prev.status !== "ABSENT" && prev.status !== "LWP" && prev.status !== "SUSPENDED");
      const holiday = holidays.get(workDate) ?? null;

      if (holiday) {
        stats.holiday += 1;
        attRows.push({
          employeeId: emp.id,
          workDate,
          status: "HOLIDAY_UNWORKED",
          source: "MANUAL",
          scheduleId: ngt.id,
          holidayId: holiday.id,
          holidayKind: holiday.kind,
          presenceBeforeHoliday,
          ruleVersion: RULE_VERSION,
          computedAt: new Date(),
        });
        prevByEmp.set(emp.id, { date: workDate, status: "HOLIDAY_UNWORKED" });
        continue;
      }

      let status: "PRESENT" | "ABSENT" | "INCOMPLETE_PUNCH" = "PRESENT";
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

      if (srand(`${key}|a`) < 0.03) {
        status = "ABSENT";
      } else {
        const late = srand(`${key}|l`);
        const lateMin = late < 0.55 ? -sint(`${key}|e`, 0, 3) : late < 0.85 ? sint(`${key}|s1`, 3, 12) : late < 0.97 ? sint(`${key}|s2`, 13, 25) : sint(`${key}|s3`, 30, 45);
        const otRoll = srand(`${key}|o`);
        const otMin = otRoll < 0.6 ? 0 : otRoll < 0.84 ? 30 : otRoll < 0.95 ? 60 : 90;
        const underMin = otMin === 0 && srand(`${key}|u`) < 0.1 ? sint(`${key}|u2`, 8, 15) : 0;
        const incomplete = srand(`${key}|p`) < 0.012;
        if (incomplete) status = "INCOMPLETE_PUNCH";
        punches = {
          inUtc: at(workDate, start + lateMin),
          break1OutUtc: null,
          break1InUtc: null,
          lunchOutUtc: at(workDate, lunchOut),
          lunchInUtc: at(workDate, lunchIn),
          break2OutUtc: null,
          break2InUtc: null,
          outUtc: incomplete ? null : at(addDays(workDate, 1), endNext + otMin - underMin - 24 * 60),
        };
      }

      const c = computeDay(workDate, ngt, punches);
      const punched = status !== "ABSENT";
      attRows.push({
        employeeId: emp.id,
        workDate,
        status,
        source: punched ? "DEVICE" : "MANUAL",
        scheduleId: ngt.id,
        punchInUtc: punches.inUtc,
        lunchOutUtc: punches.lunchOutUtc,
        lunchInUtc: punches.lunchInUtc,
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
      });
      prevByEmp.set(emp.id, { date: workDate, status });

      if (status === "PRESENT") stats.present += 1;
      else if (status === "ABSENT") stats.absent += 1;
      else stats.incomplete += 1;
      if (punched && c.otWorkedSeconds > 0) stats.ot += 1;
      if (punched && c.lateSeconds > 0) stats.late += 1;
    }
  }

  for (let i = 0; i < attRows.length; i += 400) {
    await db.insert(attendanceDay).values(attRows.slice(i, i + 400)).onConflictDoNothing();
  }

  await db
    .update(attendanceDay)
    .set({ reviewedBy: adminId, reviewedAt: new Date() })
    .where(and(inArray(attendanceDay.employeeId, emps.map((e) => e.id)), lt(attendanceDay.workDate, currentMonday), isNull(attendanceDay.reviewedAt)));

  const periodIds = new Map<string, number>();
  for (let w = WEEKS_OF_HISTORY; w >= 0; w--) {
    const monday = addDays(currentMonday, -7 * w);
    const sunday = addDays(monday, 6);
    const mondayUtc = Date.parse(`${monday}T00:00:00Z`);
    const { year, week } = isoWeek(mondayUtc);
    const periodCode = `${year}-W${pad(week)}`;
    const [y, m, d] = sunday.split("-").map(Number);
    const [inserted] = await db
      .insert(payrollPeriod)
      .values({
        periodCode,
        dateFrom: monday,
        dateTo: sunday,
        cutoffAt: new Date(manilaToUtc(y, m - 1, d, 23, 59)),
        payDate: addDays(monday, 7),
        frequency: "WEEKLY",
      })
      .onConflictDoNothing()
      .returning({ id: payrollPeriod.id });
    if (inserted) {
      periodIds.set(periodCode, inserted.id);
    } else {
      const [existing] = await db.select({ id: payrollPeriod.id }).from(payrollPeriod).where(eq(payrollPeriod.periodCode, periodCode));
      if (existing) periodIds.set(periodCode, existing.id);
    }
  }

  for (let w = WEEKS_OF_HISTORY; w >= 1; w--) {
    const monday = addDays(currentMonday, -7 * w);
    const sunday = addDays(monday, 6);
    const { year, week } = isoWeek(Date.parse(`${monday}T00:00:00Z`));
    const periodCode = `${year}-W${pad(week)}`;
    const periodId = periodIds.get(periodCode);
    if (!periodId) continue;

    const [sss] = await db.select().from(sssSchedule).where(and(lte(sssSchedule.effectiveFrom, sunday), or(isNull(sssSchedule.effectiveTo), gte(sssSchedule.effectiveTo, sunday)))).orderBy(desc(sssSchedule.effectiveFrom)).limit(1);
    const [phic] = await db.select().from(phicSchedule).where(and(lte(phicSchedule.effectiveFrom, sunday), or(isNull(phicSchedule.effectiveTo), gte(phicSchedule.effectiveTo, sunday)))).orderBy(desc(phicSchedule.effectiveFrom)).limit(1);
    const [hdmf] = await db.select().from(hdmfSchedule).where(and(lte(hdmfSchedule.effectiveFrom, sunday), or(isNull(hdmfSchedule.effectiveTo), gte(hdmfSchedule.effectiveTo, sunday)))).orderBy(desc(hdmfSchedule.effectiveFrom)).limit(1);
    const [birRow] = await db.select({ effectiveFrom: birTaxTable.effectiveFrom }).from(birTaxTable).where(and(lte(birTaxTable.effectiveFrom, sunday), or(isNull(birTaxTable.effectiveTo), gte(birTaxTable.effectiveTo, sunday)))).orderBy(desc(birTaxTable.effectiveFrom)).limit(1);
    const [premRow] = await db.select({ effectiveFrom: premiumMatrix.effectiveFrom }).from(premiumMatrix).where(and(lte(premiumMatrix.effectiveFrom, sunday), or(isNull(premiumMatrix.effectiveTo), gte(premiumMatrix.effectiveTo, sunday)))).orderBy(desc(premiumMatrix.effectiveFrom)).limit(1);
    if (!sss || !phic || !hdmf || !birRow || !premRow) throw new Error(`statutory tables missing for ${periodCode}`);

    const [run] = await db
      .insert(payrollRun)
      .values({
        periodId,
        runNo: 1,
        status: "OPEN",
        sssScheduleId: sss.id,
        phicScheduleId: phic.id,
        hdmfScheduleId: hdmf.id,
        birTableEffectiveFrom: birRow.effectiveFrom,
        birTableVariant: "NON_MANAGERIAL",
        premiumMatrixEffectiveFrom: premRow.effectiveFrom,
        holidayYear: Number(monday.slice(0, 4)),
        payruleVersion: PAYRULE_VERSION,
        scope: null,
        configSnapshot: { seededAt: new Date().toISOString() },
        initiatedBy: adminId,
      })
      .returning({ id: payrollRun.id });

    const birRows = await db.select().from(birTaxTable).where(and(eq(birTaxTable.effectiveFrom, birRow.effectiveFrom), eq(birTaxTable.variant, "NON_MANAGERIAL"))).orderBy(birTaxTable.bracketNo);
    const premRows = await db.select().from(premiumMatrix).where(eq(premiumMatrix.effectiveFrom, premRow.effectiveFrom));

    const cfg: StatConfig = {
      sss,
      phic,
      hdmf,
      bir: birRows.map((b) => ({
        bracketNo: b.bracketNo,
        bracketFrom: b.bracketFrom,
        bracketTo: b.bracketTo,
        baseTax: b.baseTax,
        marginalRate: b.marginalRate,
        overAmount: b.overAmount,
      })),
      premiums: premRows.map(
        (p): PremiumRow => ({
          holidayKind: p.holidayKind,
          isRestDay: p.isRestDay,
          worked: p.worked,
          first8hMultiplier: p.first8hMultiplier,
          otHourMultiplier: p.otHourMultiplier,
          nsdApplies: p.nsdApplies,
          payWhenUnworked: p.payWhenUnworked,
        }),
      ),
      frequency: "WEEKLY" as PayFrequency,
      cutoffIndex: 0,
    };

    const dayRows = await db
      .select()
      .from(attendanceDay)
      .where(and(inArray(attendanceDay.employeeId, emps.map((e) => e.id)), gte(attendanceDay.workDate, monday), lte(attendanceDay.workDate, sunday)));
    const daysByEmp = new Map<number, typeof dayRows>();
    for (const row of dayRows) {
      const list = daysByEmp.get(row.employeeId);
      if (list) list.push(row);
      else daysByEmp.set(row.employeeId, [row]);
    }

    const items = emps.map((emp) =>
      calcEmployee(
        {
          id: emp.id,
          baseSalaryMonthly: emp.baseSalaryMonthly,
          payFrequency: emp.payFrequency,
          isMinimumWageExempt: emp.isMinimumWageExempt,
          allowances: [],
        },
        (daysByEmp.get(emp.id) ?? []).map(
          (d): DayInput => ({
            workDate: d.workDate,
            status: d.status,
            holidayKind: d.holidayKind,
            isRestDay: d.isRestDay,
            presenceBeforeHoliday: d.presenceBeforeHoliday,
            workedSeconds: d.workedSeconds,
            scheduledSeconds: d.scheduledSeconds,
            lateSeconds: d.lateSeconds,
            undertimeSeconds: d.undertimeSeconds,
            absentSeconds: d.absentSeconds,
            otWorkedSeconds: d.otWorkedSeconds,
            nightSeconds: d.nightSeconds,
            nightOtSeconds: d.nightOtSeconds,
          }),
        ),
        cfg,
      ),
    );

    await db
      .insert(payrollJob)
      .values(emps.map((e) => ({ runId: run.id, employeeId: e.id, shard: e.id % 16, status: "DONE" as const })))
      .onConflictDoNothing();
    for (let i = 0; i < items.length; i += 25) {
      await db
        .insert(payrollRunItem)
        .values(items.slice(i, i + 25).map((item) => ({ runId: run.id, ...item, calcEngineVer: PAYRULE_VERSION })));
    }

    const grossTotal = items.reduce((s, i) => s + i.grossPay, 0);
    const deductionTotal = items.reduce((s, i) => s + i.totalDeductions, 0);
    const netTotal = items.reduce((s, i) => s + i.netPay, 0);
    await db
      .update(payrollRun)
      .set({
        status: "POSTED",
        headcount: items.length,
        grossTotal,
        deductionTotal,
        netTotal,
        approvedBy: adminId,
        approvedAt: new Date(),
        postedAt: new Date(),
      })
      .where(eq(payrollRun.id, run.id));
    console.log(`posted ${periodCode}: ${items.length} payslips, net ${netTotal / 100} PHP`);
  }

  const [vl] = await db.select().from(leaveType).where(eq(leaveType.code, "VL")).limit(1);
  const [sl] = await db.select().from(leaveType).where(eq(leaveType.code, "SL")).limit(1);
  const [gs7] = await db.select({ id: employee.id }).from(employee).where(eq(employee.employeeNo, "GS-0007")).limit(1);
  const [tx14] = await db.select({ id: employee.id }).from(employee).where(eq(employee.employeeNo, "TX-0014")).limit(1);
  const [gs11] = await db.select({ id: employee.id }).from(employee).where(eq(employee.employeeNo, "GS-0011")).limit(1);
  const [tx18] = await db.select({ id: employee.id }).from(employee).where(eq(employee.employeeNo, "TX-0018")).limit(1);

  const twoWeeksAgoTue = addDays(currentMonday, -14 + 1);
  const twoWeeksAgeWed = addDays(twoWeeksAgoTue, 1);
  if (vl && gs7) {
    const [req] = await db
      .insert(leaveRequest)
      .values({
        employeeId: gs7.id,
        leaveTypeId: vl.id,
        dateFrom: twoWeeksAgoTue,
        dateTo: twoWeeksAgeWed,
        days: 2,
        reason: "Family vacation",
        status: "APPROVED",
        filedBy: adminId,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      })
      .returning({ id: leaveRequest.id });
    for (const d of [twoWeeksAgoTue, twoWeeksAgeWed]) {
      const values = {
        employeeId: gs7.id,
        workDate: d,
        status: "LEAVE" as const,
        source: "MANUAL" as const,
        punchInUtc: null,
        break1OutUtc: null,
        break1InUtc: null,
        lunchOutUtc: null,
        lunchInUtc: null,
        break2OutUtc: null,
        break2InUtc: null,
        punchOutUtc: null,
        scheduleId: null,
        scheduledSeconds: 28_800,
        workedSeconds: 0,
        paidBreakSeconds: 0,
        lateSeconds: 0,
        undertimeSeconds: 0,
        absentSeconds: 0,
        otWorkedSeconds: 0,
        otApprovedSeconds: 0,
        nightSeconds: 0,
        nightOtSeconds: 0,
        dayMultiplier: 1,
        otMultiplier: 1,
        isRestDay: false,
        holidayId: null,
        holidayKind: "NONE" as const,
        presenceBeforeHoliday: true,
        needsReview: false,
        reviewNote: `VL leave #${req.id}`,
        reviewedBy: null,
        reviewedAt: null,
        leaveRequestId: req.id,
        ruleVersion: RULE_VERSION,
        computedAt: new Date(),
      };
      await db.insert(attendanceDay).values(values).onConflictDoUpdate({ target: [attendanceDay.employeeId, attendanceDay.workDate], set: values });
    }
  }
  if (sl && tx14) {
    const [req] = await db
      .insert(leaveRequest)
      .values({
        employeeId: tx14.id,
        leaveTypeId: sl.id,
        dateFrom: twoWeeksAgoTue,
        dateTo: twoWeeksAgeWed,
        days: 2,
        reason: "Sick with doctor's note",
        status: "APPROVED",
        filedBy: adminId,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      })
      .returning({ id: leaveRequest.id });
    for (const d of [twoWeeksAgoTue, twoWeeksAgeWed]) {
      const values = {
        employeeId: tx14.id,
        workDate: d,
        status: "LEAVE" as const,
        source: "MANUAL" as const,
        punchInUtc: null,
        break1OutUtc: null,
        break1InUtc: null,
        lunchOutUtc: null,
        lunchInUtc: null,
        break2OutUtc: null,
        break2InUtc: null,
        punchOutUtc: null,
        scheduleId: null,
        scheduledSeconds: 28_800,
        workedSeconds: 0,
        paidBreakSeconds: 0,
        lateSeconds: 0,
        undertimeSeconds: 0,
        absentSeconds: 0,
        otWorkedSeconds: 0,
        otApprovedSeconds: 0,
        nightSeconds: 0,
        nightOtSeconds: 0,
        dayMultiplier: 1,
        otMultiplier: 1,
        isRestDay: false,
        holidayId: null,
        holidayKind: "NONE" as const,
        presenceBeforeHoliday: true,
        needsReview: false,
        reviewNote: `SL leave #${req.id}`,
        reviewedBy: null,
        reviewedAt: null,
        leaveRequestId: req.id,
        ruleVersion: RULE_VERSION,
        computedAt: new Date(),
      };
      await db.insert(attendanceDay).values(values).onConflictDoUpdate({ target: [attendanceDay.employeeId, attendanceDay.workDate], set: values });
    }
  }
  const nextMon = addDays(currentMonday, 7);
  const nextTue = addDays(nextMon, 1);
  if (vl && gs11) {
    await db.insert(leaveRequest).values({
      employeeId: gs11.id, leaveTypeId: vl.id, dateFrom: nextMon, dateTo: nextTue, days: 2,
      reason: "Personal errand", status: "PENDING", filedBy: adminId,
    });
  }
  if (sl && tx18) {
    await db.insert(leaveRequest).values({
      employeeId: tx18.id, leaveTypeId: sl.id, dateFrom: nextMon, dateTo: nextTue, days: 2,
      reason: "Medical checkup", status: "PENDING", filedBy: adminId,
    });
  }

  await db.insert(announcement).values([
    { title: "Graveyard snacks are back", body: "Free coffee and snacks at the pantry every 10 PM. Enjoy!", pinned: true, authorId: adminId },
    { title: "Payroll cutoff reminder", body: "Weekly cutoff ends Sunday 11:59 PM. File DTR corrections before then.", pinned: false, authorId: adminId },
    { title: "Team building this month", body: "Google Search and Tax Response squads — see your TL for the schedule.", pinned: false, authorId: adminId },
  ]);

  console.log("\n=== DEMO DATA READY ===");
  console.log(`campaigns: Google Search + Tax Response · 40 employees on WEEKLY pay, graveyard 21:00-06:00`);
  console.log(`attendance: ${attendanceFrom} → ${today} (${attRows.length} rows) · past ${WEEKS_OF_HISTORY} weeks DTR-approved`);
  console.log(`payroll: ${WEEKS_OF_HISTORY} weekly runs calculated+posted · current week open for live calc`);
  console.log(`leave: 2 approved + 2 pending · announcements: 3`);
  if (CREDS.length > 0) {
    console.log("\nlogins (password shown once):");
    for (const line of CREDS) console.log(`  ${line}`);
  }
  console.log(`  ${owner ? "(existing admin/HR account unchanged)" : "demo.admin@hrweb.local  " + DEMO_PASSWORD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
