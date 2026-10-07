/**
 * Every monetary value in this codebase is an INTEGER NUMBER OF CENTAVOS.
 * There is no `round2` because centavos are already the precision floor.
 */

export function roundHalfUp(value: number): number {
  if (!Number.isFinite(value)) throw new Error(`not a number: ${value}`);
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

export function clamp(value: number, min: number, max: number): number {
  if (min > max) throw new Error(`clamp: min ${min} > max ${max}`);
  return value < min ? min : value > max ? max : value;
}

/** Smallest multiple of `step` >= value. */
export function ceilToStep(value: number, step: number): number {
  if (step <= 0) throw new Error(`ceilToStep: step must be > 0, got ${step}`);
  if (value <= 0) return 0;
  return Math.ceil(value / step) * step;
}

/** Largest multiple of `step` <= value (>= 0). */
export function floorToStep(value: number, step: number): number {
  if (step <= 0) throw new Error(`floorToStep: step must be > 0, got ${step}`);
  if (value <= 0) return 0;
  return Math.floor(value / step) * step;
}

export const DAYS_PER_MONTH = 22;
export const HOURS_PER_DAY = 8;

/** DOLE: daily rate = monthly basic / 22 working days. */
export function dailyRate(monthlyCents: number): number {
  return roundHalfUp(monthlyCents / DAYS_PER_MONTH);
}

/** DOLE: hourly rate = daily rate / 8 hours. */
export function hourlyRate(monthlyCents: number): number {
  return roundHalfUp(dailyRate(monthlyCents) / HOURS_PER_DAY);
}

/**
 * Split a MONTHLY statutory amount across periodic cutoffs so the period
 * totals are exact — no centavo drift over a month.
 *
 * The second cutoff absorbs the residual: half(1001) = 501 + 500 = 1001.
 */
export function splitPeriodAmount(monthlyCents: number, cutoffIndex: number, cutoffs: number): number {
  if (cutoffs <= 1) return monthlyCents;
  const base = roundHalfUp(monthlyCents / cutoffs);
  if (cutoffIndex === cutoffs - 1) return monthlyCents - base * (cutoffs - 1);
  return base;
}

/**
 * Semi-monthly statutory deductions are computed on the MONTHLY figure and
 * halved; the second cutoff absorbs the odd centavo.
 */
export function semiMonthly(monthlyCents: number, isSecondCutoff: boolean): number {
  return splitPeriodAmount(monthlyCents, isSecondCutoff ? 1 : 0, 2);
}

let moneyFmt = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
});

let dateFmt = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "UTC" });

/**
 * Overrides the display currency / date style / group separators from saved
 * settings. Server-only, called once per render from the root layout — no
 * client component uses these formatters, so hydration stays consistent.
 */
export function setLocaleSettings(opts: {
  currency: string;
  dateStyle: "full" | "long" | "medium" | "short";
  grouping: boolean;
}): void {
  try {
    moneyFmt = new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: opts.currency,
      minimumFractionDigits: 2,
      useGrouping: opts.grouping,
    });
  } catch {
    // unsupported currency code — keep the current formatter
  }
  dateFmt = new Intl.DateTimeFormat("en-PH", {
    dateStyle: opts.dateStyle,
    timeZone: "UTC",
  });
}

/** 1234567 -> "₱12,345.67" */
export function formatPhp(cents: number): string {
  return moneyFmt.format(cents / 100);
}

/** "₱12,345.67" / "12345.67" -> 1234567. Returns null when unparseable. */
export function parsePhpToCents(input: string): number | null {
  const cleaned = input.replace(/[,\s₱]/g, "");
  if (!/^-?\d{1,15}(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? roundHalfUp(value * 100) : null;
}

/** "2026-01-31" -> "January 31, 2026" */
export function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return dateFmt.format(d);
}

