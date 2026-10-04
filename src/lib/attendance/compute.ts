import { manilaToUtc, nightOverlapSeconds } from "@/lib/time";

const DAY_MS = 86_400_000;
const MIN_MS = 60_000;

export type ShiftTemplateInput = {
  startsAt: string;
  endsAt: string;
  break1Start: string;
  break1End: string;
  lunchStart: string;
  lunchEnd: string;
  break2Start: string;
  break2End: string;
};

export type PunchSet = {
  inUtc: Date | null;
  break1OutUtc: Date | null;
  break1InUtc: Date | null;
  lunchOutUtc: Date | null;
  lunchInUtc: Date | null;
  break2OutUtc: Date | null;
  break2InUtc: Date | null;
  outUtc: Date | null;
};

export type ComputedDay = {
  scheduledSeconds: number;
  workedSeconds: number;
  paidBreakSeconds: number;
  lateSeconds: number;
  undertimeSeconds: number;
  otWorkedSeconds: number;
  nightSeconds: number;
  nightOtSeconds: number;
  complete: boolean;
  needsReview: boolean;
  reviewNote: string | null;
};

/** Manila "HH:MM" -> epoch ms anchored to workDate; rolled forward past afterMs for overnight windows. */
function at(workDate: string, hhmm: string, afterMs: number, inclusive = false): number {
  const [y, m, d] = workDate.split("-").map(Number);
  const [h, min] = hhmm.split(":").map(Number);
  let ms = manilaToUtc(y, m - 1, d, h, min);
  while (inclusive ? ms <= afterMs : ms < afterMs) ms += DAY_MS;
  return ms;
}

const ms = (d: Date | null): number | null => (d ? d.getTime() : null);

/**
 * Pure timekeeping for one attendance day from (punches, shift).
 * Lunch is unpaid; AM/PM breaks are paid and counted inside worked time.
 * Break variances and missing punches are surfaced as review notes.
 */
export function computeDay(
  workDate: string,
  shift: ShiftTemplateInput,
  punches: PunchSet,
): ComputedDay {
  const shiftStartMs = at(workDate, shift.startsAt, -1);
  const shiftEndMs = at(workDate, shift.endsAt, shiftStartMs, true);
  const b1Start = at(workDate, shift.break1Start, shiftStartMs);
  const b1End = at(workDate, shift.break1End, b1Start);
  const lunchStartMs = at(workDate, shift.lunchStart, shiftStartMs);
  const lunchEndMs = at(workDate, shift.lunchEnd, lunchStartMs);
  const b2Start = at(workDate, shift.break2Start, lunchEndMs);
  const b2End = at(workDate, shift.break2End, b2Start);

  const scheduledLunchMs = lunchEndMs - lunchStartMs;
  const scheduledSeconds = Math.max(
    0,
    Math.round((shiftEndMs - shiftStartMs - scheduledLunchMs) / 1000),
  );

  const inMs = ms(punches.inUtc);
  const outMs = ms(punches.outUtc);
  const b1Out = ms(punches.break1OutUtc);
  const b1In = ms(punches.break1InUtc);
  const lOut = ms(punches.lunchOutUtc);
  const lIn = ms(punches.lunchInUtc);
  const b2Out = ms(punches.break2OutUtc);
  const b2In = ms(punches.break2InUtc);

  const complete = inMs !== null && outMs !== null;
  const notes: string[] = [];

  let workedMs = 0;
  let lunchMs = scheduledLunchMs;
  if (lOut !== null && lIn !== null) lunchMs = Math.max(0, lIn - lOut);

  if (complete) {
    const span = Math.max(0, (outMs as number) - (inMs as number));
    workedMs = Math.max(0, span - lunchMs);
  }

  const pairMs = (out: number | null, inn: number | null): number =>
    out !== null && inn !== null ? Math.max(0, inn - out) : 0;
  const paidBreakSeconds = Math.round((pairMs(b1Out, b1In) + pairMs(b2Out, b2In)) / 1000);

  const lateSeconds =
    inMs !== null ? Math.max(0, Math.round((inMs - shiftStartMs) / 1000)) : 0;
  const undertimeSeconds = complete
    ? Math.max(0, Math.round((shiftEndMs - (outMs as number)) / 1000))
    : 0;
  const otWorkedSeconds = complete
    ? Math.max(0, Math.round(((outMs as number) - shiftEndMs) / 1000))
    : 0;

  const mealWindow: readonly (readonly [number, number])[] =
    lOut !== null && lIn !== null ? [[lOut, lIn]] : [];
  const nightSeconds =
    complete ? nightOverlapSeconds(inMs as number, outMs as number, mealWindow) : 0;
  const nightOtSeconds =
    complete && (outMs as number) > shiftEndMs
      ? nightOverlapSeconds(shiftEndMs, outMs as number, mealWindow)
      : 0;

  const window = (label: string, s: number, e: number, po: number | null, pi: number | null) => {
    if (po !== null && pi !== null) {
      const diff = pi - po - (e - s);
      if (Math.abs(diff) >= MIN_MS) {
        notes.push(`${label} ${Math.round(Math.abs(diff) / MIN_MS)}m ${diff > 0 ? "over" : "under"}`);
      }
    } else if (complete) {
      notes.push(`${label} not punched`);
    }
  };
  window("1st break", b1Start, b1End, b1Out, b1In);
  window("Lunch", lunchStartMs, lunchEndMs, lOut, lIn);
  window("2nd break", b2Start, b2End, b2Out, b2In);

  if (inMs === null) notes.unshift("Missing punch in");
  else if (outMs === null) notes.push("Missing punch out");
  if (complete && ((outMs as number) < (inMs as number) || (lIn !== null && lOut !== null && lIn < lOut))) {
    notes.push("Punches out of order");
  }

  return {
    scheduledSeconds,
    workedSeconds: Math.round(workedMs / 1000),
    paidBreakSeconds,
    lateSeconds,
    undertimeSeconds,
    otWorkedSeconds,
    nightSeconds,
    nightOtSeconds,
    complete,
    needsReview: notes.length > 0,
    reviewNote: notes.length > 0 ? notes.join("; ") : null,
  };
}
