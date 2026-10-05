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

export type WeekReadiness = {
  ready: boolean;
  missing: string[];
  flagged: string[];
  approved: boolean;
};

/** Pure readiness check for one employee over a week/period range. */
export function weekReadiness(
  required: readonly string[],
  rows: readonly { workDate: string; needsReview: boolean; reviewedAt: Date | null }[],
): WeekReadiness {
  const byDate = new Map(rows.map((r) => [r.workDate, r]));
  const missing = required.filter((d) => !byDate.has(d));
  const flagged = rows.filter((r) => r.needsReview).map((r) => r.workDate);
  const approved =
    missing.length === 0 &&
    flagged.length === 0 &&
    required.every((d) => byDate.get(d)?.reviewedAt != null);
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
 * Payroll gate: employees whose period range has any required day that is
 * missing or not yet reviewed. Returns their employee numbers.
 */
export function unreviewedOffenders(
  emps: readonly GateEmployee[],
  period: { dateFrom: string; dateTo: string },
  rows: readonly { employeeId: number; workDate: string; reviewedAt: Date | null }[],
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
    });
    if (required.some((d) => !reviewed.has(`${e.id}|${d}`))) offenders.push(e.employeeNo);
  }
  return offenders;
}
