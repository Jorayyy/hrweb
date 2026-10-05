import { clamp, floorToStep, roundHalfUp, splitPeriodAmount } from "../money";

export type HolidayKind =
  | "NONE"
  | "REGULAR"
  | "SPECIAL_NONWORKING"
  | "SPECIAL_HALF_DAY"
  | "LOCAL";

export type PayFrequency = "SEMI_MONTHLY" | "MONTHLY" | "WEEKLY" | "DAILY";

export const PAY_FREQUENCY_PERIODS: Record<PayFrequency, number> = {
  DAILY: 261,
  WEEKLY: 52,
  MONTHLY: 12,
  SEMI_MONTHLY: 24,
};

export const SSS_2026 = {
  effectiveFrom: "2025-01-01",
  totalRate: 0.15,
  eeRate: 0.05,
  erRate: 0.1,
  mscMin: 500000,
  mscMax: 3500000,
  mscStep: 50000,
  wispThreshold: 2000000,
  ecThreshold: 1500000,
  ecAmountLow: 1000,
  ecAmountHigh: 3000,
  sourceRef: "RA 11199; SSS Schedule of Contributions effective 01 Jan 2025 (in force for 2026)",
};
export type SssConfig = typeof SSS_2026;

export const PHIC_2026 = {
  effectiveFrom: "2026-01-01",
  premiumRate: 0.05,
  baseFloor: 1000000,
  baseCeiling: 10000000,
  eeShare: 0.5,
  erShare: 0.5,
  sourceRef: "RA 11223 IRR; PhilHealth advisory 06 May 2025 (final scheduled rate 5.00%)",
};
export type PhicConfig = typeof PHIC_2026;

export const HDMF_2026 = {
  effectiveFrom: "2026-01-01",
  eeRate: 0.02,
  erRate: 0.02,
  compCeiling: 1000000,
  maxContribution: 20000,
  sourceRef: "RA 9679; HDMF Circular No. 460 (s. 2024): 2% EE + 2% ER on first ₱10,000",
};
export type HdmfConfig = typeof HDMF_2026;

export type BirBracket = {
  bracketNo: number;
  bracketFrom: number;
  bracketTo: number | null;
  baseTax: number;
  marginalRate: number;
  overAmount: number;
};

export const BIR_ANNUAL_2026: readonly BirBracket[] = [
  { bracketNo: 1, bracketFrom: 0, bracketTo: 25000000, baseTax: 0, marginalRate: 0, overAmount: 0 },
  { bracketNo: 2, bracketFrom: 25000000, bracketTo: 40000000, baseTax: 0, marginalRate: 0.15, overAmount: 25000000 },
  { bracketNo: 3, bracketFrom: 40000000, bracketTo: 80000000, baseTax: 2250000, marginalRate: 0.2, overAmount: 40000000 },
  { bracketNo: 4, bracketFrom: 80000000, bracketTo: 200000000, baseTax: 10250000, marginalRate: 0.25, overAmount: 80000000 },
  { bracketNo: 5, bracketFrom: 200000000, bracketTo: 800000000, baseTax: 40250000, marginalRate: 0.3, overAmount: 200000000 },
  { bracketNo: 6, bracketFrom: 800000000, bracketTo: null, baseTax: 220250000, marginalRate: 0.35, overAmount: 800000000 },
];

export type PremiumRow = {
  holidayKind: HolidayKind;
  isRestDay: boolean;
  worked: boolean;
  first8hMultiplier: number;
  otHourMultiplier: number;
  nsdApplies: boolean;
  payWhenUnworked: boolean;
};

export const DOLE =
  "DOLE Labor Advisory No. 12-25 (s.2025); Handbook on Workers' Statutory Monetary Benefits";

export const PREMIUM_MATRIX_2026: readonly PremiumRow[] = [
  { holidayKind: "NONE", isRestDay: false, worked: true, first8hMultiplier: 1.0, otHourMultiplier: 1.25, nsdApplies: true, payWhenUnworked: false },
  { holidayKind: "NONE", isRestDay: true, worked: true, first8hMultiplier: 1.3, otHourMultiplier: 1.69, nsdApplies: true, payWhenUnworked: false },
  { holidayKind: "SPECIAL_NONWORKING", isRestDay: false, worked: true, first8hMultiplier: 1.3, otHourMultiplier: 1.69, nsdApplies: true, payWhenUnworked: false },
  { holidayKind: "SPECIAL_NONWORKING", isRestDay: true, worked: true, first8hMultiplier: 1.5, otHourMultiplier: 1.95, nsdApplies: true, payWhenUnworked: false },
  { holidayKind: "REGULAR", isRestDay: false, worked: true, first8hMultiplier: 2.0, otHourMultiplier: 2.6, nsdApplies: true, payWhenUnworked: false },
  { holidayKind: "REGULAR", isRestDay: true, worked: true, first8hMultiplier: 2.6, otHourMultiplier: 3.38, nsdApplies: true, payWhenUnworked: false },
  { holidayKind: "NONE", isRestDay: false, worked: false, first8hMultiplier: 1.0, otHourMultiplier: 1.25, nsdApplies: false, payWhenUnworked: false },
  { holidayKind: "NONE", isRestDay: true, worked: false, first8hMultiplier: 1.0, otHourMultiplier: 1.69, nsdApplies: false, payWhenUnworked: false },
  { holidayKind: "SPECIAL_NONWORKING", isRestDay: false, worked: false, first8hMultiplier: 1.0, otHourMultiplier: 1.69, nsdApplies: false, payWhenUnworked: false },
  { holidayKind: "SPECIAL_NONWORKING", isRestDay: true, worked: false, first8hMultiplier: 1.0, otHourMultiplier: 1.95, nsdApplies: false, payWhenUnworked: false },
  { holidayKind: "REGULAR", isRestDay: false, worked: false, first8hMultiplier: 1.0, otHourMultiplier: 2.6, nsdApplies: false, payWhenUnworked: true },
  { holidayKind: "REGULAR", isRestDay: true, worked: false, first8hMultiplier: 1.0, otHourMultiplier: 3.38, nsdApplies: false, payWhenUnworked: true },
];

export const PROCLAMATION_1006 = "Proclamation No. 1006 (s. 2025)";

export const HOLIDAYS_2026: readonly { date: string; kind: HolidayKind; name: string }[] = [
  { date: "2026-01-01", kind: "REGULAR", name: "New Year's Day" },
  { date: "2026-04-02", kind: "REGULAR", name: "Maundy Thursday" },
  { date: "2026-04-03", kind: "REGULAR", name: "Good Friday" },
  { date: "2026-04-09", kind: "REGULAR", name: "Araw ng Kagitingan" },
  { date: "2026-05-01", kind: "REGULAR", name: "Labor Day" },
  { date: "2026-06-12", kind: "REGULAR", name: "Independence Day" },
  { date: "2026-08-31", kind: "REGULAR", name: "National Heroes Day" },
  { date: "2026-11-30", kind: "REGULAR", name: "Bonifacio Day" },
  { date: "2026-12-25", kind: "REGULAR", name: "Christmas Day" },
  { date: "2026-12-30", kind: "REGULAR", name: "Rizal Day" },
  { date: "2026-02-17", kind: "SPECIAL_NONWORKING", name: "Chinese New Year" },
  { date: "2026-04-04", kind: "SPECIAL_NONWORKING", name: "Black Saturday" },
  { date: "2026-08-21", kind: "SPECIAL_NONWORKING", name: "Ninoy Aquino Day" },
  { date: "2026-11-01", kind: "SPECIAL_NONWORKING", name: "All Saints' Day" },
  { date: "2026-11-02", kind: "SPECIAL_NONWORKING", name: "All Souls' Day" },
  { date: "2026-12-08", kind: "SPECIAL_NONWORKING", name: "Feast of the Immaculate Conception of Mary" },
  { date: "2026-12-24", kind: "SPECIAL_NONWORKING", name: "Christmas Eve" },
  { date: "2026-12-31", kind: "SPECIAL_NONWORKING", name: "Last Day of the Year" },
];

export type AllowanceSeed = {
  code: string;
  name: string;
  taxable: boolean;
  monthlyCap: number | null;
  annualCap: number | null;
  isFixed: boolean;
};

// Ceilings per RR No. 29-2025 (issued 22 Dec 2025, effective 06 Jan 2026).
export const ALLOWANCE_TYPES_2026: readonly AllowanceSeed[] = [
  { code: "RICE", name: "Rice subsidy", taxable: false, monthlyCap: 250000, annualCap: null, isFixed: true },
  { code: "CLOTHING", name: "Uniform / clothing allowance", taxable: false, monthlyCap: null, annualCap: 800000, isFixed: true },
  { code: "MEDICAL", name: "Medical / hospitalization reimbursement", taxable: false, monthlyCap: null, annualCap: 1200000, isFixed: false },
  { code: "LAUNDRY", name: "Laundry allowance", taxable: false, monthlyCap: 40000, annualCap: null, isFixed: true },
  { code: "MEAL", name: "Meal / daytime allowance", taxable: false, monthlyCap: null, annualCap: null, isFixed: true },
  { code: "GIFT", name: "Gift on major milestone", taxable: false, monthlyCap: null, annualCap: 600000, isFixed: false },
  { code: "ACHIEVE", name: "Achievement award (tangible, non-cash)", taxable: false, monthlyCap: null, annualCap: 1200000, isFixed: false },
  { code: "RD_SUB", name: "Representation allowance", taxable: true, monthlyCap: null, annualCap: null, isFixed: true },
  { code: "PERF_BONUS", name: "Performance / productivity bonus", taxable: true, monthlyCap: null, annualCap: null, isFixed: false },
  { code: "COLA", name: "Cost-of-living allowance", taxable: true, monthlyCap: null, annualCap: null, isFixed: true },
];

/**
 * Basic monthly salary -> Monthly Salary Credit. SSS tables are written as
 * salary bands that step at the midpoint of each ₱500 MSC increment
 * (₱5,249.99 -> MSC 5,000; ₱5,250.00 -> MSC 5,500), so this is a
 * round-half-up to the step, not a ceiling.
 */
export function mscFor(cfg: SssConfig, monthlyBasicCents: number): number {
  return clamp(
    floorToStep(monthlyBasicCents + cfg.mscStep / 2, cfg.mscStep),
    cfg.mscMin,
    cfg.mscMax,
  );
}

export type SssResult = {
  msc: number;
  regularEe: number;
  regularEr: number;
  wispEe: number;
  wispEr: number;
  ec: number;
  totalEe: number;
  totalEr: number;
};

export function computeSss(cfg: SssConfig, monthlyBasicCents: number): SssResult {
  const msc = mscFor(cfg, monthlyBasicCents);
  const regularMsc = Math.min(msc, cfg.wispThreshold);
  const wispMsc = msc - regularMsc;

  const totalEe = roundHalfUp(msc * cfg.eeRate);
  const wispEe = roundHalfUp(wispMsc * cfg.eeRate);
  const totalEr = roundHalfUp(msc * cfg.erRate);
  const wispEr = roundHalfUp(wispMsc * cfg.erRate);

  const ec = msc >= cfg.ecThreshold ? cfg.ecAmountHigh : cfg.ecAmountLow;

  return {
    msc,
    regularEe: totalEe - wispEe,
    regularEr: totalEr - wispEr,
    wispEe,
    wispEr,
    ec,
    totalEe,
    totalEr: totalEr + ec,
  };
}

export type PhicResult = { base: number; premium: number; ee: number; er: number };

export function computePhic(cfg: PhicConfig, monthlyBasicCents: number): PhicResult {
  const base = clamp(monthlyBasicCents, cfg.baseFloor, cfg.baseCeiling);
  const premium = roundHalfUp((base * cfg.premiumRate) / 100) * 100;
  const ee = roundHalfUp(premium * cfg.eeShare);
  return { base, premium, ee, er: premium - ee };
}

export type HdmfResult = { base: number; ee: number; er: number };

export function computeHdmf(cfg: HdmfConfig, monthlyBasicCents: number): HdmfResult {
  const base = Math.min(monthlyBasicCents, cfg.compCeiling);
  const ee = Math.min(roundHalfUp(base * cfg.eeRate), cfg.maxContribution);
  const er = Math.min(roundHalfUp(base * cfg.erRate), cfg.maxContribution);
  return { base, ee, er };
}

export function birAnnualTax(
  brackets: readonly BirBracket[],
  annualTaxableCents: number,
): number {
  const taxable = Math.max(0, annualTaxableCents);
  const b = brackets.find((x) => taxable <= (x.bracketTo ?? Number.POSITIVE_INFINITY));
  if (!b) throw new Error(`bir: no bracket for ${taxable}`);
  return b.baseTax + roundHalfUp((taxable - b.overAmount) * b.marginalRate);
}

/**
 * Periodic withholding = annual tax on the annualised taxable pay, spread
 * evenly across the year's cutoffs with the residual centavo landing on the
 * final cutoff, so `sum(periods) === annualTax` exactly.
 */
export function birPeriodicTax(
  brackets: readonly BirBracket[],
  frequency: PayFrequency,
  periodTaxableCents: number,
  cutoffIndex: number,
): number {
  const n = PAY_FREQUENCY_PERIODS[frequency];
  return splitPeriodAmount(
    birAnnualTax(brackets, Math.max(0, periodTaxableCents) * n),
    cutoffIndex,
    n,
  );
}

export function premiumFor(
  rows: readonly PremiumRow[],
  kind: HolidayKind,
  isRestDay: boolean,
  worked: boolean,
): PremiumRow {
  const k =
    kind === "LOCAL" || kind === "SPECIAL_HALF_DAY" ? "SPECIAL_NONWORKING" : kind;
  const row = rows.find(
    (r) => r.holidayKind === k && r.isRestDay === isRestDay && r.worked === worked,
  );
  if (!row) {
    throw new Error(`premium matrix: no row for ${k} rest=${isRestDay} worked=${worked}`);
  }
  return row;
}
