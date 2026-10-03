/**
 * Asia/Manila is fixed UTC+08:00 with no daylight saving, so wall-clock
 * arithmetic is pure integer offset maths — no tz database needed.
 */
export const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

/** Epoch ms for a Manila wall-clock Y-M-D h:m. */
export function manilaToUtc(
  year: number,
  monthIndex: number,
  day: number,
  hour = 0,
  minute = 0,
): number {
  return Date.UTC(year, monthIndex, day, hour, minute) - MANILA_OFFSET_MS;
}

function manilaParts(utcMs: number) {
  const d = new Date(utcMs + MANILA_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    monthIndex: d.getUTCMonth(),
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
}

/** Manila calendar date of an instant, as 'YYYY-MM-DD'. */
export function manilaDateKey(utcMs: number): string {
  const { year, monthIndex, day } = manilaParts(utcMs);
  const mm = String(monthIndex + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/** Postgres dow: 0=Sunday .. 6=Saturday. */
export function manilaDayOfWeek(utcMs: number): number {
  return new Date(utcMs + MANILA_OFFSET_MS).getUTCDay();
}

/**
 * Seconds of [startMs, endMs) that fall between 22:00 and 06:00 Manila time,
 * minus any supplied unpaid meal windows. Crosses any number of midnights.
 *
 * Implemented as intersection against the recurring local night band, so a
 * 22:00 -> 06:00 shift is one contiguous 8-hour band regardless of the date
 * stamp on either punch.
 */
export function nightOverlapSeconds(
  startMs: number,
  endMs: number,
  mealWindowsMs: readonly (readonly [number, number])[] = [],
): number {
  if (endMs <= startMs) return 0;

  let total = 0;
  const { year, monthIndex, day } = manilaParts(startMs);
  // Walk Manila calendar days forward from the start date.
  let cursor = Date.UTC(year, monthIndex, day);

  // One extra day of slack so a start at 23:59 still gets its band.
  for (let guard = 0; guard < 400; guard++) {
    const bandStart = cursor + 22 * 3600_000 - MANILA_OFFSET_MS;
    const bandEnd = cursor + DAY_MS + 6 * 3600_000 - MANILA_OFFSET_MS;
    if (bandStart >= endMs) break;

    const lo = Math.max(startMs, bandStart);
    const hi = Math.min(endMs, bandEnd);
    if (lo < hi) total += (hi - lo) / 1000;

    cursor += DAY_MS;
  }

  for (const [mealStart, mealEnd] of mealWindowsMs) {
    const lo = Math.max(startMs, mealStart);
    const hi = Math.min(endMs, mealEnd);
    if (lo < hi) total -= (hi - lo) / 1000;
  }

  return Math.max(0, Math.round(total));
}
