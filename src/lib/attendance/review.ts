import { eq, ilike, or, type SQL } from "drizzle-orm";
import { employee } from "@/db/schema";
import { dateKeyDayOfWeek } from "./anchor";

const DAY_MS = 86_400_000;

/** All date keys from `from` to `to` inclusive (YYYY-MM-DD, lexicographically ordered). */
export function dateRange(from: string, to: string): string[] {
  if (from > to) return [];
  const out: string[] = [];
  for (
    let t = Date.parse(`${from}T00:00:00Z`), end = Date.parse(`${to}T00:00:00Z`);
    t <= end;
    t += DAY_MS
  ) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

export function addDays(dateKey: string, days: number): string {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** Monday of the week containing dateKey. */
export function mondayOf(dateKey: string): string {
  const dow = dateKeyDayOfWeek(dateKey);
  return addDays(dateKey, -((dow + 6) % 7));
}

/**
 * Dates that must have an attendance row before the week/period can be approved:
 * from max(from, dateHired) to `to`, excluding the employee's weekly rest days.
 */
export function requiredDates(opts: {
  from: string;
  to: string;
  dateHired: string;
  weeklyRestDays: readonly number[];
}): string[] {
  const start = opts.from > opts.dateHired ? opts.from : opts.dateHired;
  return dateRange(start, opts.to).filter(
    (d) => !opts.weeklyRestDays.includes(dateKeyDayOfWeek(d)),
  );
}

export type DtrFilter = { campaignId: number; deptId: number; ccId: number; q: string };

function idOf(v: string | undefined): number {
  return v && /^\d+$/.test(v) ? Number(v) : 0;
}

/** Whitelists campaign/dept/cost-center/q from a query string or a parsed params object. */
export function parseDtrFilter(f: string | Record<string, string | undefined>): DtrFilter {
  const src = new URLSearchParams(typeof f === "string" ? f : "");
  if (typeof f !== "string") {
    for (const [k, v] of Object.entries(f)) if (v) src.set(k, v);
  }
  return {
    campaignId: idOf(src.get("campaign") ?? undefined),
    deptId: idOf(src.get("dept") ?? undefined),
    ccId: idOf(src.get("cc") ?? undefined),
    q: (src.get("q") ?? "").trim().toLowerCase().slice(0, 50),
  };
}

export function encodeDtrFilter(fl: DtrFilter): string {
  const p = new URLSearchParams();
  if (fl.campaignId) p.set("campaign", String(fl.campaignId));
  if (fl.deptId) p.set("dept", String(fl.deptId));
  if (fl.ccId) p.set("cc", String(fl.ccId));
  if (fl.q) p.set("q", fl.q);
  return p.toString();
}

export function hasEmployeeFilter(fl: DtrFilter): boolean {
  return Boolean(fl.campaignId || fl.deptId || fl.ccId || fl.q);
}

export function matchFilteredEmployee(
  fl: DtrFilter,
  e: {
    firstName: string;
    lastName: string;
    employeeNo: string;
    campaignId: number | null;
    departmentId: number | null;
    costCenterId: number | null;
  },
): boolean {
  if (fl.campaignId && e.campaignId !== fl.campaignId) return false;
  if (fl.deptId && e.departmentId !== fl.deptId) return false;
  if (fl.ccId && e.costCenterId !== fl.ccId) return false;
  if (fl.q && !matchesQuery(fl.q, e)) return false;
  return true;
}

function matchesQuery(
  q: string,
  e: { firstName: string; lastName: string; employeeNo: string },
): boolean {
  return (
    e.firstName.toLowerCase().includes(q) ||
    e.lastName.toLowerCase().includes(q) ||
    e.employeeNo.toLowerCase().includes(q)
  );
}

/**
 * SQL conditions matching `matchFilteredEmployee` — push these into the query
 * instead of filtering a full employee list in memory.
 */
export function employeeFilterConditions(fl: DtrFilter): SQL[] {
  const out: SQL[] = [];
  if (fl.campaignId) out.push(eq(employee.campaignId, fl.campaignId));
  if (fl.deptId) out.push(eq(employee.departmentId, fl.deptId));
  if (fl.ccId) out.push(eq(employee.costCenterId, fl.ccId));
  if (fl.q) {
    const pattern = `%${fl.q}%`;
    out.push(
      or(
        ilike(employee.firstName, pattern),
        ilike(employee.lastName, pattern),
        ilike(employee.employeeNo, pattern),
      )!,
    );
  }
  return out;
}

export type WeekReadiness = {
  ready: boolean;
  missing: string[];
  flagged: string[];
  approved: boolean;
};

/** Pure readiness check for one employee over a week/period range. With `today`, days after it are ignored. */
export function weekReadiness(
  required: readonly string[],
  rows: readonly { workDate: string; needsReview: boolean; reviewedAt: Date | null }[],
  today?: string,
): WeekReadiness {
  const byDate = new Map(rows.map((r) => [r.workDate, r]));
  const elapsed = today ? required.filter((d) => d <= today) : required;
  const missing = elapsed.filter((d) => !byDate.has(d));
  const flagged = rows.filter((r) => r.needsReview).map((r) => r.workDate);
  const approved =
    missing.length === 0 &&
    flagged.length === 0 &&
    elapsed.every((d) => byDate.get(d)?.reviewedAt != null) &&
    (required.length === 0 || elapsed.length > 0);
  return {
    ready: missing.length === 0 && flagged.length === 0,
    missing,
    flagged,
    approved,
  };
}

export type GateEmployee = {
  id: number;
  employeeNo: string;
  dateHired: string;
  weeklyRestDays: readonly number[];
};

/**
 * Payroll gate: employees whose elapsed period days (up to `today`, if given)
 * are missing or not yet reviewed. Returns their employee numbers.
 */
export function unreviewedOffenders(
  emps: readonly GateEmployee[],
  period: { dateFrom: string; dateTo: string },
  rows: readonly { employeeId: number; workDate: string; reviewedAt: Date | null }[],
  today?: string,
): string[] {
  const reviewed = new Set(
    rows.filter((r) => r.reviewedAt != null).map((r) => `${r.employeeId}|${r.workDate}`),
  );
  const offenders: string[] = [];
  for (const e of emps) {
    const required = requiredDates({
      from: period.dateFrom,
      to: period.dateTo,
      dateHired: e.dateHired,
      weeklyRestDays: e.weeklyRestDays,
    }).filter((d) => !today || d <= today);
    if (required.some((d) => !reviewed.has(`${e.id}|${d}`))) offenders.push(e.employeeNo);
  }
  return offenders;
}
