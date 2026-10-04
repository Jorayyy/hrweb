"use server";

import { redirect } from "next/navigation";
import { and, desc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import {
  allowanceType,
  attendanceDay,
  birTaxTable,
  employee,
  employeeAllowance,
  hdmfSchedule,
  payrollPeriod,
  payrollRun,
  payrollRunItem,
  phicSchedule,
  premiumMatrix,
  sssSchedule,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { manilaDateKey, manilaToUtc } from "@/lib/time";
import {
  calcEmployee,
  type DayInput,
  type EmployeeInput,
  type RunItemComputed,
  type StatConfig,
} from "./calc";
import type { PayFrequency, PremiumRow } from "@/lib/statutory/ph";

const PAYRULE_VERSION = "pay-2026.1";
const ENGINE_VERSION = "pay-2026.1";

const ALLOWED: Record<string, readonly string[]> = {
  calculate: ["OPEN", "CUT_OFF", "CALCULATING", "CALCULATED", "REVIEW", "APPROVED"],
  approve: ["CALCULATED", "REVIEW"],
  post: ["APPROVED"],
  void: ["OPEN", "CUT_OFF", "CALCULATING", "CALCULATED", "REVIEW", "APPROVED"],
};

const pad = (n: number) => String(n).padStart(2, "0");

function back(periodId: number, runId?: number, error?: string): never {
  const qs = new URLSearchParams({ period: String(periodId) });
  if (runId) qs.set("run", String(runId));
  if (error) qs.set("error", error);
  redirect(`/payroll?${qs.toString()}`);
}

export async function openPeriod(): Promise<never> {
  await requireRole("ADMIN", "PAYROLL");

  const today = manilaDateKey(Date.now());
  const [y, m, d] = today.split("-").map(Number);

  let dateFrom: string;
  let dateTo: string;
  let periodCode: string;
  let payDate: string;
  const cutoffY = y;
  const cutoffM = m;
  let cutoffD: number;

  if (d <= 15) {
    dateFrom = `${y}-${pad(m)}-01`;
    dateTo = `${y}-${pad(m)}-15`;
    periodCode = `${y}-${pad(m)}-A`;
    payDate = `${y}-${pad(m)}-25`;
    cutoffD = 15;
  } else {
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    dateFrom = `${y}-${pad(m)}-16`;
    dateTo = `${y}-${pad(m)}-${pad(lastDay)}`;
    periodCode = `${y}-${pad(m)}-B`;
    cutoffD = lastDay;
    const ny = m === 12 ? y + 1 : y;
    const nm = m === 12 ? 1 : m + 1;
    payDate = `${ny}-${pad(nm)}-10`;
  }

  const cutoffAt = new Date(manilaToUtc(cutoffY, cutoffM - 1, cutoffD, 23, 59));

  const [inserted] = await db
    .insert(payrollPeriod)
    .values({ periodCode, dateFrom, dateTo, cutoffAt, payDate, frequency: "SEMI_MONTHLY" })
    .onConflictDoNothing()
    .returning({ id: payrollPeriod.id });

  if (inserted) back(inserted.id);

  const [existing] = await db
    .select({ id: payrollPeriod.id })
    .from(payrollPeriod)
    .where(eq(payrollPeriod.periodCode, periodCode))
    .limit(1);
  if (!existing) redirect("/payroll?error=Could not open the period.");
  back(existing.id);
}

export async function createRun(periodId: number): Promise<never> {
  const user = await requireRole("ADMIN", "PAYROLL");

  const [period] = await db
    .select()
    .from(payrollPeriod)
    .where(eq(payrollPeriod.id, periodId))
    .limit(1);
  if (!period) back(periodId, undefined, "Period not found.");

  const [sss] = await db
    .select()
    .from(sssSchedule)
    .where(lte(sssSchedule.effectiveFrom, period.dateTo))
    .orderBy(desc(sssSchedule.effectiveFrom))
    .limit(1);
  const [phic] = await db
    .select()
    .from(phicSchedule)
    .where(lte(phicSchedule.effectiveFrom, period.dateTo))
    .orderBy(desc(phicSchedule.effectiveFrom))
    .limit(1);
  const [hdmf] = await db
    .select()
    .from(hdmfSchedule)
    .where(lte(hdmfSchedule.effectiveFrom, period.dateTo))
    .orderBy(desc(hdmfSchedule.effectiveFrom))
    .limit(1);
  if (!sss || !phic || !hdmf) back(periodId, undefined, "Statutory tables missing — run db:seed.");

  const [birRow] = await db
    .select({ effectiveFrom: birTaxTable.effectiveFrom })
    .from(birTaxTable)
    .where(lte(birTaxTable.effectiveFrom, period.dateTo))
    .orderBy(desc(birTaxTable.effectiveFrom))
    .limit(1);
  const [premRow] = await db
    .select({ effectiveFrom: premiumMatrix.effectiveFrom })
    .from(premiumMatrix)
    .where(lte(premiumMatrix.effectiveFrom, period.dateTo))
    .orderBy(desc(premiumMatrix.effectiveFrom))
    .limit(1);
  if (!birRow || !premRow) back(periodId, undefined, "Tax/premium tables missing — run db:seed.");

  const [maxRun] = await db
    .select({ runNo: payrollRun.runNo })
    .from(payrollRun)
    .where(eq(payrollRun.periodId, periodId))
    .orderBy(desc(payrollRun.runNo))
    .limit(1);

  const [run] = await db
    .insert(payrollRun)
    .values({
      periodId,
      runNo: (maxRun?.runNo ?? 0) + 1,
      status: "OPEN",
      sssScheduleId: sss.id,
      phicScheduleId: phic.id,
      hdmfScheduleId: hdmf.id,
      birTableEffectiveFrom: birRow.effectiveFrom,
      birTableVariant: "NON_MANAGERIAL",
      premiumMatrixEffectiveFrom: premRow.effectiveFrom,
      holidayYear: Number(period.dateFrom.slice(0, 4)),
      payruleVersion: PAYRULE_VERSION,
      configSnapshot: {
        generatedAt: new Date().toISOString(),
        sss,
        phic,
        hdmf,
        birEffectiveFrom: birRow.effectiveFrom,
        premiumMatrixEffectiveFrom: premRow.effectiveFrom,
      },
      initiatedBy: user.id,
    })
    .returning({ id: payrollRun.id });

  back(periodId, run.id);
}

export async function calculateRun(periodId: number, runId: number): Promise<never> {
  await requireRole("ADMIN", "PAYROLL");

  const [run] = await db
    .select()
    .from(payrollRun)
    .where(and(eq(payrollRun.id, runId), eq(payrollRun.periodId, periodId)))
    .limit(1);
  if (!run) back(periodId, undefined, "Run not found.");
  if (run.status === "POSTED" || run.status === "VOID")
    back(periodId, runId, "Posted or voided runs are immutable.");

  const [period] = await db
    .select()
    .from(payrollPeriod)
    .where(eq(payrollPeriod.id, periodId))
    .limit(1);
  if (!period) back(periodId, runId, "Period not found.");

  const [sssRow] = await db
    .select()
    .from(sssSchedule)
    .where(eq(sssSchedule.id, run.sssScheduleId))
    .limit(1);
  const [phicRow] = await db
    .select()
    .from(phicSchedule)
    .where(eq(phicSchedule.id, run.phicScheduleId))
    .limit(1);
  const [hdmfRow] = await db
    .select()
    .from(hdmfSchedule)
    .where(eq(hdmfSchedule.id, run.hdmfScheduleId))
    .limit(1);
  const birRows = await db
    .select()
    .from(birTaxTable)
    .where(
      and(
        eq(birTaxTable.effectiveFrom, run.birTableEffectiveFrom),
        eq(birTaxTable.variant, run.birTableVariant),
      ),
    )
    .orderBy(birTaxTable.bracketNo);
  const premRows = await db
    .select()
    .from(premiumMatrix)
    .where(eq(premiumMatrix.effectiveFrom, run.premiumMatrixEffectiveFrom));

  if (!sssRow || !phicRow || !hdmfRow || birRows.length === 0 || premRows.length === 0)
    back(periodId, runId, "Run configuration is incomplete.");

  const emps = await db
    .select({
      id: employee.id,
      baseSalaryMonthly: employee.baseSalaryMonthly,
      payFrequency: employee.payFrequency,
      isMinimumWageExempt: employee.isMinimumWageExempt,
    })
    .from(employee)
    .where(inArray(employee.status, ["ACTIVE", "ON_LEAVE"]))
    .orderBy(employee.lastName, employee.firstName)
    .limit(5000);
  if (emps.length === 0) back(periodId, runId, "No active employees to calculate.");

  const ids = emps.map((e) => e.id);
  const allowanceRows = await db
    .select({
      employeeId: employeeAllowance.employeeId,
      code: allowanceType.code,
      name: allowanceType.name,
      amount: employeeAllowance.amount,
      taxable: allowanceType.taxable,
    })
    .from(employeeAllowance)
    .innerJoin(allowanceType, eq(employeeAllowance.allowanceId, allowanceType.id))
    .where(
      and(
        inArray(employeeAllowance.employeeId, ids),
        lte(employeeAllowance.validFrom, period.dateTo),
        or(isNull(employeeAllowance.validTo), gte(employeeAllowance.validTo, period.dateFrom))!,
      ),
    );

  const dayRows = await db
    .select()
    .from(attendanceDay)
    .where(
      and(
        inArray(attendanceDay.employeeId, ids),
        gte(attendanceDay.workDate, period.dateFrom),
        lte(attendanceDay.workDate, period.dateTo),
      ),
    );

  const cfg: StatConfig = {
    sss: sssRow,
    phic: phicRow,
    hdmf: hdmfRow,
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
    frequency: period.frequency as PayFrequency,
    cutoffIndex:
      period.frequency === "SEMI_MONTHLY" && Number(period.dateFrom.slice(8, 10)) > 15 ? 1 : 0,
  };

  const daysByEmp = new Map<number, (typeof dayRows)[number][]>();
  for (const row of dayRows) {
    const list = daysByEmp.get(row.employeeId);
    if (list) list.push(row);
    else daysByEmp.set(row.employeeId, [row]);
  }
  const allowancesByEmp = new Map<number, EmployeeInput["allowances"]>();
  for (const row of allowanceRows) {
    const list = allowancesByEmp.get(row.employeeId);
    const entry = { code: row.code, name: row.name, amount: row.amount, taxable: row.taxable };
    if (list) list.push(entry);
    else allowancesByEmp.set(row.employeeId, [entry]);
  }

  const items: RunItemComputed[] = [];
  for (const emp of emps) {
    const days = (daysByEmp.get(emp.id) ?? []).map(
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
    );
    items.push(
      calcEmployee(
        {
          id: emp.id,
          baseSalaryMonthly: emp.baseSalaryMonthly,
          payFrequency: emp.payFrequency,
          isMinimumWageExempt: emp.isMinimumWageExempt,
          allowances: allowancesByEmp.get(emp.id) ?? [],
        },
        days,
        cfg,
      ),
    );
  }

  await db.delete(payrollRunItem).where(eq(payrollRunItem.runId, runId));
  for (const item of items) {
    const { status, ...values } = item;
    await db
      .insert(payrollRunItem)
      .values({ runId, ...values, status, calcEngineVer: ENGINE_VERSION });
  }

  const grossTotal = items.reduce((s, i) => s + i.grossPay, 0);
  const deductionTotal = items.reduce((s, i) => s + i.totalDeductions, 0);
  const netTotal = items.reduce((s, i) => s + i.netPay, 0);

  await db
    .update(payrollRun)
    .set({
      status: "CALCULATED",
      headcount: items.length,
      grossTotal,
      deductionTotal,
      netTotal,
      approvedBy: null,
      approvedAt: null,
    })
    .where(eq(payrollRun.id, runId));

  back(periodId, runId);
}

export async function transitionRun(
  periodId: number,
  runId: number,
  action: keyof typeof ALLOWED,
): Promise<never> {
  const user = await requireRole("ADMIN", "PAYROLL");

  const [run] = await db
    .select({ status: payrollRun.status })
    .from(payrollRun)
    .where(and(eq(payrollRun.id, runId), eq(payrollRun.periodId, periodId)))
    .limit(1);
  if (!run) back(periodId, undefined, "Run not found.");

  const allowed = ALLOWED[action];
  if (!allowed || !allowed.includes(run.status))
    back(periodId, runId, `Cannot ${action} a run in status ${run.status}.`);

  if (action === "approve") {
    await db
      .update(payrollRun)
      .set({ status: "APPROVED", approvedBy: user.id, approvedAt: new Date() })
      .where(eq(payrollRun.id, runId));
  } else if (action === "post") {
    await db
      .update(payrollRun)
      .set({ status: "POSTED", postedAt: new Date() })
      .where(eq(payrollRun.id, runId));
  } else if (action === "void") {
    await db.update(payrollRun).set({ status: "VOID" }).where(eq(payrollRun.id, runId));
  }

  back(periodId, runId);
}
