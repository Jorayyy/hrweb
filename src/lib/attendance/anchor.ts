/**
 * Which attendance row a punch belongs to.
 *
 * A punch's calendar date is not its operational date: OUT at 06:07 belongs
 * to yesterday's 22:00-06:00 shift, not to today. Until schedule_day exists,
 * resolve by prerequisite chain — today's row wins when it can accept the
 * punch, otherwise yesterday's open row (the shift that started before
 * midnight) takes it.
 *
 * ponytail: calendar-day heuristic; replace anchor with schedule_day once
 * per-date scheduling lands (Phase 5).
 */

export type AnchorDay = {
  date: string;
  hasPrereq: boolean;
  hasSlot: boolean;
};

export function resolveAnchorDate(
  slotNeedsPrereq: boolean,
  today: AnchorDay,
  prev: AnchorDay | null,
): string {
  if (!slotNeedsPrereq) return today.date;
  if (today.hasSlot) return today.date;
  if (today.hasPrereq) return today.date;
  if (prev?.hasPrereq && !prev.hasSlot) return prev.date;
  if (prev?.hasSlot) return prev.date;
  return today.date;
}

/** Postgres dow of a Manila date key: 0=Sunday .. 6=Saturday. */
export function dateKeyDayOfWeek(dateKey: string): number {
  return new Date(`${dateKey}T12:00:00Z`).getUTCDay();
}
