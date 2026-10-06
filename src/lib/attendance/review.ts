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

export type DtrFilter = { campaignId: number; deptId: number; q: string };

/** Whitelists campaign/dept/q from a raw query string (e.g. a hidden form field). */
export function parseDtrFilter(f: string): DtrFilter {
  const src = new URLSearchParams(f);
  const campaign = src.get("campaign") ?? "";
  const dept = src.get("dept") ?? "";
  return {
    campaignId: /^\d+$/.test(campaign) ? Number(campaign) : 0,
    deptId: /^\d+$/.test(dept) ? Number(dept) : 0,
    q: (src.get("q") ?? "").trim().toLowerCase().slice(0, 50),
  };
}

export function encodeDtrFilter(fl: DtrFilter): string {
  const p = new URLSearchParams();
  if (fl.campaignId) p.set("campaign", String(fl.campaignId));
  if (fl.deptId) p.set("dept", String(fl.deptId));
  if (fl.q) p.set("q", fl.q);
  return p.toString();
}

export function matchFilteredEmployee(
  fl: DtrFilter,
  e: {
    firstName: string;
    lastName: string;
    employeeNo: string;
    campaignId: number | null;
    departmentId: number | null;
  },
): boolean {
  if (fl.campaignId && e.campaignId !== fl.campaignId) return false;
  if (fl.deptId && e.departmentId !== fl.deptId) return false;
  if (fl.q && !`${e.firstName} ${e.lastName} ${e.employeeNo}`.toLowerCase().includes(fl.q))
    return false;
  return true;
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
