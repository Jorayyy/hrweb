import { and, count, desc, eq, gte, inArray, lt, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  attendanceDay,
  birTaxTable,
  employee,
  hdmfSchedule,
  payrollJob,
  payrollPeriod,
  payrollRun,
  payrollRunItem,
  phicSchedule,
  premiumMatrix,
  sssSchedule,
} from "@/db/schema";
import { unreviewedOffenders } from "@/lib/attendance/review";
import { formatDate, formatPhp } from "@/lib/money";
import { manilaDateKey } from "@/lib/time";

export type Check = {
  key: string;
  label: string;
  ok: boolean;
  blocking: boolean;
  detail: string;
  fix?: { href: string; text: string };
};

export type Readiness = {
  checks: Check[];
  ready: boolean;
  runId: number | null;
  runNo: number | null;
};

const CALCULATED_STATUSES = new Set(["CALCULATED", "REVIEW", "APPROVED", "POSTED"]);

export function blockingFailures(checks: readonly Check[]): Check[] {
  return checks.filter((c) => c.blocking && !c.ok);
}

export function reconcileTotals(
  items: readonly { grossPay: number; totalDeductions: number; netPay: number }[],
  run: { grossTotal: number | null; deductionTotal: number | null; netTotal: number | null },
): { ok: boolean; detail: string } {
  if (items.length === 0) return { ok: false, detail: "Run has no calculated rows yet." };
  if (run.grossTotal == null || run.deductionTotal == null || run.netTotal == null)
    return { ok: false, detail: "Run has no stored totals yet." };
  const sums = items.reduce(
    (acc, i) => ({
      gross: acc.gross + i.grossPay,
      ded: acc.ded + i.totalDeductions,
      net: acc.net + i.netPay,
    }),
    { gross: 0, ded: 0, net: 0 },
  );
  const bad = [
    sums.gross !== run.grossTotal ? "gross" : null,
    sums.ded !== run.deductionTotal ? "deductions" : null,
    sums.net !== run.netTotal ? "net" : null,
  ].filter((x): x is string => x !== null);
  if (bad.length > 0)
    return {
      ok: false,
      detail: `Stored run ${bad.join("/")} total does not match the ${items.length} register row(s) — recalculate.`,
    };
  return {
    ok: true,
    detail: `${items.length} rows · ${formatPhp(sums.gross)} gross · ${formatPhp(sums.net)} net all add up.`,
  };
}

/**
 * Pre-post recheck for one period. Blocking checks refuse approve/post;
 * warnings are shown but do not block.
 */
export async function periodReadiness(periodId: number, runId?: number): Promise<Readiness> {
  const [period] = await db
    .select()
    .from(payrollPeriod)
    .where(eq(payrollPeriod.id, periodId))
    .limit(1);
  if (!period)
    return {
      checks: [
        { key: "period", label: "Period exists", ok: false, blocking: true, detail: "Period not found." },
      ],
      ready: false,
      runId: null,
      runNo: null,
    };

  const checks: Check[] = [];
  const today = manilaDateKey(Date.now());
  checks.push({
    key: "period-ended",
    label: "Cutoff has ended",
    ok: period.dateTo < today,
    blocking: true,
    detail:
      period.dateTo < today
        ? `Ended ${formatDate(period.dateTo)}.`
        : `Ends ${formatDate(period.dateTo)} — calculate after the cutoff.`,
  });

  const payFamily =
    period.frequency === "WEEKLY"
      ? (["WEEKLY", "DAILY"] as const)
      : (["SEMI_MONTHLY", "MONTHLY"] as const);
  const emps = await db
    .select({
      id: employee.id,
      employeeNo: employee.employeeNo,
      dateHired: employee.dateHired,
      weeklyRestDays: employee.weeklyRestDays,
    })
    .from(employee)
    .where(
      and(
        inArray(employee.status, ["ACTIVE", "ON_LEAVE"]),
        inArray(employee.payFrequency, payFamily),
      ),
    );
  const dayRows =
    emps.length > 0
      ? await db
          .select({
            employeeId: attendanceDay.employeeId,
            workDate: attendanceDay.workDate,
            reviewedAt: attendanceDay.reviewedAt,
          })
          .from(attendanceDay)
          .where(
            and(
              inArray(
                attendanceDay.employeeId,
                emps.map((e) => e.id),
              ),
              gte(attendanceDay.workDate, period.dateFrom),
              lte(attendanceDay.workDate, period.dateTo),
            ),
          )
      : [];
  const offenders = unreviewedOffenders(emps, period, dayRows);
  checks.push({
    key: "dtr-approved",
    label: "DTR approved for everyone",
    ok: offenders.length === 0,
    blocking: true,
    detail:
      offenders.length === 0
        ? `${emps.length} employee(s) on ${period.frequency.toLowerCase()} pay.`
        : `Missing or unreviewed days for ${offenders.length} employee(s): ${offenders
            .slice(0, 3)
            .join(", ")}${offenders.length > 3 ? ", …" : ""}.`,
    fix: offenders.length > 0 ? { href: "/dtr-review", text: "Open DTR Review" } : undefined,
  });

  const runs = await db
    .select()
    .from(payrollRun)
    .where(eq(payrollRun.periodId, periodId))
    .orderBy(desc(payrollRun.runNo));
  const run =
    (runId ? runs.find((r) => r.id === runId) : undefined) ??
    runs.find((r) => r.status !== "VOID") ??
    runs[0] ??
    null;

  if (!run) {
    checks.push({
      key: "run-active",
      label: "Payroll run exists",
      ok: false,
      blocking: true,
      detail: "This period has no run yet.",
      fix: { href: "/payroll", text: "Create a run" },
    });
    return { checks, ready: false, runId: null, runNo: null };
  }
  if (run.status === "VOID") {
    checks.push({
      key: "run-active",
      label: "Payroll run exists",
      ok: false,
      blocking: true,
      detail: `Run #${run.runNo} is void — create a new run.`,
      fix: { href: "/payroll", text: "Create a run" },
    });
    return { checks, ready: false, runId: run.id, runNo: run.runNo };
  }

  checks.push({
    key: "run-active",
    label: "Payroll run exists",
    ok: true,
    blocking: true,
    detail: `Run #${run.runNo}.`,
  });

  const calculated = CALCULATED_STATUSES.has(run.status);
  checks.push({
    key: "calculated",
    label: "Run calculated",
    ok: calculated,
    blocking: true,
    detail: calculated
      ? `Status ${run.status.replace("_", " ").toLowerCase()}.`
      : `Run is ${run.status.toLowerCase()} — hit Calculate below.`,
  });
  if (!calculated)
    return { checks, ready: false, runId: run.id, runNo: run.runNo };

  const [failed] = await db
    .select({ n: count() })
    .from(payrollJob)
    .where(and(eq(payrollJob.runId, run.id), eq(payrollJob.status, "FAILED")));
  checks.push({
    key: "jobs-clean",
    label: "No failed calculations",
    ok: (failed?.n ?? 0) === 0,
    blocking: true,
    detail:
      (failed?.n ?? 0) === 0
        ? "Every employee job finished."
        : `${failed?.n} employee(s) failed to calculate — recalculate before approving.`,
  });

  const items = await db
    .select({
      grossPay: payrollRunItem.grossPay,
      totalDeductions: payrollRunItem.totalDeductions,
      netPay: payrollRunItem.netPay,
    })
    .from(payrollRunItem)
    .where(eq(payrollRunItem.runId, run.id));
  const totals = reconcileTotals(items, run);
  checks.push({ key: "totals", label: "Totals reconcile", ok: totals.ok, blocking: true, detail: totals.detail });

  const [sss, phic, hdmf, bir, prem] = await Promise.all([
    db.select({ id: sssSchedule.id }).from(sssSchedule).where(eq(sssSchedule.id, run.sssScheduleId)).limit(1),
    db.select({ id: phicSchedule.id }).from(phicSchedule).where(eq(phicSchedule.id, run.phicScheduleId)).limit(1),
    db.select({ id: hdmfSchedule.id }).from(hdmfSchedule).where(eq(hdmfSchedule.id, run.hdmfScheduleId)).limit(1),
    db
      .select({ effectiveFrom: birTaxTable.effectiveFrom })
      .from(birTaxTable)
      .where(
        and(
          eq(birTaxTable.effectiveFrom, run.birTableEffectiveFrom),
          eq(birTaxTable.variant, run.birTableVariant),
        ),
      )
      .limit(1),
    db
      .select({ effectiveFrom: premiumMatrix.effectiveFrom })
      .from(premiumMatrix)
      .where(eq(premiumMatrix.effectiveFrom, run.premiumMatrixEffectiveFrom))
      .limit(1),
  ]);
  const configOk = Boolean(sss && phic && hdmf && bir && prem && run.configSnapshot && run.payruleVersion);
  checks.push({
    key: "config",
    label: "Statutory snapshot intact",
    ok: configOk,
    blocking: true,
    detail: configOk
      ? `${run.payruleVersion} · SSS/PHIC/HDMF/BIR/premium rows resolve.`
      : "Tables referenced by this run are missing — recalculate to re-snapshot.",
  });

  const rosterDrift = run.headcount == null || run.headcount !== emps.length;
  checks.push({
    key: "headcount",
    label: "Roster matches the run",
    ok: !rosterDrift,
    blocking: false,
    detail: rosterDrift
      ? `Run has ${run.headcount ?? "no"} row(s) but ${emps.length} active employee(s) fit this cutoff — roster changed since Calculate.`
      : `${emps.length} employee(s).`,
  });

  const [prev] = await db
    .select()
    .from(payrollPeriod)
    .where(and(eq(payrollPeriod.frequency, period.frequency), lt(payrollPeriod.dateTo, period.dateTo)))
    .orderBy(desc(payrollPeriod.dateTo))
    .limit(1);
  if (prev) {
    const [posted] = await db
      .select({ n: count() })
      .from(payrollRun)
      .where(and(eq(payrollRun.periodId, prev.id), eq(payrollRun.status, "POSTED")));
    checks.push({
      key: "previous-posted",
      label: "Previous cutoff posted",
      ok: (posted?.n ?? 0) > 0,
      blocking: false,
      detail:
        (posted?.n ?? 0) > 0
          ? `${prev.periodCode} is posted.`
          : `${prev.periodCode} has no posted run yet.`,
      fix:
        (posted?.n ?? 0) > 0 ? undefined : { href: `/payroll/periods/${prev.id}`, text: `Open ${prev.periodCode}` },
    });
  }

  const [voided] = await db
    .select({ n: count() })
    .from(payrollRun)
    .where(and(eq(payrollRun.periodId, periodId), eq(payrollRun.status, "VOID")));
  checks.push({
    key: "void-runs",
    label: "No voided runs",
    ok: (voided?.n ?? 0) === 0,
    blocking: false,
    detail:
      (voided?.n ?? 0) === 0
        ? "None."
        : `${voided?.n} voided run(s) on this period — kept for audit.`,
  });

  return {
    checks,
    ready: blockingFailures(checks).length === 0,
    runId: run.id,
    runNo: run.runNo,
  };
}
