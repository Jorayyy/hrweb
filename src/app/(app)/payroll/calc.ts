import {
  PAY_FREQUENCY_PERIODS,
  birPeriodicTax,
  computeHdmf,
  computePhic,
  computeSss,
  premiumFor,
  type BirBracket,
  type HdmfConfig,
  type HolidayKind,
  type PayFrequency,
  type PhicConfig,
  type PremiumRow,
  type SssConfig,
} from "@/lib/statutory/ph";
import { dailyRate, hourlyRate, roundHalfUp, semiMonthly } from "@/lib/money";

export type StatConfig = {
  sss: SssConfig;
  phic: PhicConfig;
  hdmf: HdmfConfig;
  bir: readonly BirBracket[];
  premiums: readonly PremiumRow[];
  frequency: PayFrequency;
  cutoffIndex: number;
};

export type AllowanceInput = {
  code: string;
  name: string;
  amount: number;
  taxable: boolean;
};

export type EmployeeInput = {
  id: number;
  baseSalaryMonthly: number;
  payFrequency: PayFrequency;
  isMinimumWageExempt: boolean;
  allowances: AllowanceInput[];
};

export type DayInput = {
  workDate: string;
  status: string;
  holidayKind: HolidayKind;
  isRestDay: boolean;
  presenceBeforeHoliday: boolean;
  workedSeconds: number;
  scheduledSeconds: number;
  lateSeconds: number;
  undertimeSeconds: number;
  absentSeconds: number;
  otWorkedSeconds: number;
  nightSeconds: number;
  nightOtSeconds: number;
};

export type RunItemComputed = {
  employeeId: number;
  daysWorked: number;
  daysAbsent: number;
  daysLeavePaid: number;
  daysHolidayRh: number;
  daysHolidaySnw: number;
  hoursRegular: number;
  hoursOtOrd: number;
  hoursOtRd: number;
  hoursOtSpecl: number;
  hoursOtRh: number;
  hoursOtRhRd: number;
  hoursNsd: number;
  lateSeconds: number;
  undertimeSeconds: number;
  basicPay: number;
  otPay: number;
  nsdPay: number;
  holidayPay: number;
  restDayPay: number;
  otherEarnings: number;
  grossPay: number;
  taxablePay: number;
  totalDeductions: number;
  totalEmployer: number;
  netPay: number;
  sssEe: number;
  sssEr: number;
  sssWispEe: number;
  sssWispEr: number;
  phicEe: number;
  phicEr: number;
  hdmfEe: number;
  hdmfEr: number;
  birTax: number;
  status: "CALCULATED" | "REVIEW";
};

const ABSENT_STATUSES = new Set(["ABSENT", "LWP", "SUSPENDED"]);

function perPeriod(monthlyCents: number, cfg: StatConfig): number {
  if (cfg.frequency === "MONTHLY") return monthlyCents;
  if (cfg.frequency === "SEMI_MONTHLY") return semiMonthly(monthlyCents, cfg.cutoffIndex === 1);
  return splitByFrequency(monthlyCents, cfg);
}

function splitByFrequency(monthlyCents: number, cfg: StatConfig): number {
  const n = PAY_FREQUENCY_PERIODS[cfg.frequency] ?? 1;
  if (n <= 1) return monthlyCents;
  const base = roundHalfUp(monthlyCents / n);
  return cfg.cutoffIndex === n - 1 ? monthlyCents - base * (n - 1) : base;
}

function allowanceForPeriod(monthlyCents: number, cfg: StatConfig): number {
  if (cfg.frequency === "SEMI_MONTHLY") return semiMonthly(monthlyCents, cfg.cutoffIndex === 1);
  if (cfg.frequency === "MONTHLY") return monthlyCents;
  return splitByFrequency(monthlyCents, cfg);
}

export function calcEmployee(
  emp: EmployeeInput,
  days: readonly DayInput[],
  cfg: StatConfig,
): RunItemComputed {
  const daily = dailyRate(emp.baseSalaryMonthly);
  const hourly = hourlyRate(emp.baseSalaryMonthly);

  let daysWorked = 0;
  let daysAbsent = 0;
  let daysLeavePaid = 0;
  let daysHolidayRh = 0;
  let daysHolidaySnw = 0;
  let otOrd = 0;
  let otRd = 0;
  let otSpecl = 0;
  let otRh = 0;
  let otRhRd = 0;
  let nsdHours = 0;
  let regularHours = 0;
  let lateSeconds = 0;
  let undertimeSeconds = 0;
  let otPay = 0;
  let nsdPay = 0;
  let holidayPay = 0;
  let restDayPay = 0;

  for (const d of days) {
    const worked = d.workedSeconds > 0;
    const hoursWorked = d.workedSeconds / 3600;

    if (worked) daysWorked++;
    if (ABSENT_STATUSES.has(d.status)) daysAbsent++;
    if (d.status === "LEAVE") daysLeavePaid++;
    lateSeconds += d.lateSeconds;
    undertimeSeconds += d.undertimeSeconds;

    const m = premiumFor(cfg.premiums, d.holidayKind, d.isRestDay, worked);

    if (d.holidayKind === "REGULAR" && (worked || m.payWhenUnworked)) daysHolidayRh++;
    if (d.holidayKind === "SPECIAL_NONWORKING" && worked) daysHolidaySnw++;

    if (!worked) {
      // ponytail: fixed-salary periods already absorb the unworked-RH day via the
      // fixed period share; only daily/weekly pay needs the explicit 100% line.
      if (
        m.payWhenUnworked &&
        d.presenceBeforeHoliday &&
        (emp.payFrequency === "DAILY" || emp.payFrequency === "WEEKLY")
      ) {
        holidayPay += roundHalfUp(daily * m.first8hMultiplier);
      }
      continue;
    }

    const otSeconds = Math.min(d.otWorkedSeconds, d.workedSeconds);
    const otHours = otSeconds / 3600;
    regularHours += hoursWorked - otHours;
    nsdHours += d.nightSeconds / 3600;

    otPay += roundHalfUp(hourly * otHours * m.otHourMultiplier);
    if (d.holidayKind === "REGULAR") {
      if (d.isRestDay) otRhRd += otHours;
      else otRh += otHours;
    } else if (d.holidayKind !== "NONE") {
      otSpecl += otHours;
    } else if (d.isRestDay) {
      otRd += otHours;
    } else {
      otOrd += otHours;
    }

    if (m.nsdApplies && d.nightSeconds > 0) {
      const nightOt = Math.min(d.nightOtSeconds, otSeconds);
      const nightRegular = Math.max(0, d.nightSeconds - nightOt);
      nsdPay += roundHalfUp(
        hourly *
          (nightRegular / 3600 + (nightOt / 3600) * m.otHourMultiplier) *
          0.1,
      );
    }

    const premiumBase = roundHalfUp(daily * (m.first8hMultiplier - 1) * (Math.min(hoursWorked, 8) / 8));
    if (d.holidayKind !== "NONE") holidayPay += premiumBase;
    else if (d.isRestDay) restDayPay += premiumBase;
  }

  let basicPay: number;
  if (emp.payFrequency === "MONTHLY") {
    // Fixed monthly salary: one full month across the month's cutoff runs, no absence deduction.
    basicPay =
      cfg.frequency === "MONTHLY"
        ? emp.baseSalaryMonthly
        : semiMonthly(emp.baseSalaryMonthly, cfg.cutoffIndex === 1);
  } else if (emp.payFrequency === "SEMI_MONTHLY") {
    basicPay = Math.max(0, semiMonthly(emp.baseSalaryMonthly, cfg.cutoffIndex === 1) - daysAbsent * daily);
  } else {
    // WEEKLY / DAILY paid: no work, no pay.
    basicPay = (daysWorked + daysLeavePaid) * daily;
  }

  let otherEarnings = 0;
  let nonTaxableAllowances = 0;
  for (const a of emp.allowances) {
    const amount = allowanceForPeriod(a.amount, cfg);
    otherEarnings += amount;
    if (!a.taxable) nonTaxableAllowances += amount;
  }

  const grossPay = basicPay + otPay + nsdPay + holidayPay + restDayPay + otherEarnings;

  const sss = computeSss(cfg.sss, emp.baseSalaryMonthly);
  const phic = computePhic(cfg.phic, emp.baseSalaryMonthly);
  const hdmf = computeHdmf(cfg.hdmf, emp.baseSalaryMonthly);

  const sssEe = perPeriod(sss.regularEe, cfg);
  const sssWispEe = perPeriod(sss.wispEe, cfg);
  const sssEr = perPeriod(sss.regularEr + sss.ec, cfg);
  const sssWispEr = perPeriod(sss.wispEr, cfg);
  const phicEe = perPeriod(phic.ee, cfg);
  const phicEr = perPeriod(phic.er, cfg);
  const hdmfEe = perPeriod(hdmf.ee, cfg);
  const hdmfEr = perPeriod(hdmf.er, cfg);

  const statutoryEe = sssEe + sssWispEe + phicEe + hdmfEe;
  const taxablePay = Math.max(0, grossPay - statutoryEe - nonTaxableAllowances);
  const birTax = emp.isMinimumWageExempt
    ? 0
    : birPeriodicTax(cfg.bir, cfg.frequency, taxablePay, cfg.cutoffIndex);

  const totalDeductions = statutoryEe + birTax;
  const rawNet = grossPay - totalDeductions;
  const netPay = Math.max(0, rawNet);
  const totalEmployer = sssEr + sssWispEr + phicEr + hdmfEr;

  return {
    employeeId: emp.id,
    daysWorked,
    daysAbsent,
    daysLeavePaid,
    daysHolidayRh,
    daysHolidaySnw,
    hoursRegular: roundHours(regularHours),
    hoursOtOrd: roundHours(otOrd),
    hoursOtRd: roundHours(otRd),
    hoursOtSpecl: roundHours(otSpecl),
    hoursOtRh: roundHours(otRh),
    hoursOtRhRd: roundHours(otRhRd),
    hoursNsd: roundHours(nsdHours),
    lateSeconds,
    undertimeSeconds,
    basicPay,
    otPay,
    nsdPay,
    holidayPay,
    restDayPay,
    otherEarnings,
    grossPay,
    taxablePay,
    totalDeductions,
    totalEmployer,
    netPay,
    sssEe,
    sssEr,
    sssWispEe,
    sssWispEr,
    phicEe,
    phicEr,
    hdmfEe,
    hdmfEr,
    birTax,
    status: rawNet < 0 ? "REVIEW" : "CALCULATED",
  };
}

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}
