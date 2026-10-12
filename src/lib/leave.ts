import { dateKeyDayOfWeek } from "@/lib/attendance/anchor";

/** Inclusive list of YYYY-MM-DD keys from `from` to `to`. */
export function enumerateDays(from: string, to: string): string[] {
  const out: string[] = [];
  let cursor = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  while (cursor <= end) {
    out.push(new Date(cursor).toISOString().slice(0, 10));
    cursor += 86_400_000;
  }
  return out;
}

/**
 * Days that consume a leave balance: calendar days minus the employee's weekly
 * rest days and company holidays. Postgres dow: 0=Sun .. 6=Sat.
 */
export function workdays(
  from: string,
  to: string,
  restDays: readonly number[],
  holidays: ReadonlySet<string>,
): string[] {
  return enumerateDays(from, to).filter((d) => !restDays.includes(dateKeyDayOfWeek(d)) && !holidays.has(d));
}

/** Inclusive range overlap — used to block double-filed leave. */
export function rangesOverlap(aFrom: string, aTo: string, bFrom: string, bTo: string): boolean {
  return aFrom <= bTo && aTo >= bFrom;
}
