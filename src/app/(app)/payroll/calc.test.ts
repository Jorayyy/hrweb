import { describe, expect, it } from "vitest";
import {
  BIR_ANNUAL_2026,
  HDMF_2026,
  PHIC_2026,
  PREMIUM_MATRIX_2026,
  SSS_2026,
} from "@/lib/statutory/ph";
import { calcEmployee, type DayInput, type EmployeeInput, type StatConfig } from "./calc";

const cfg: StatConfig = {
  sss: SSS_2026,
  phic: PHIC_2026,
  hdmf: HDMF_2026,
  bir: BIR_ANNUAL_2026,
  premiums: PREMIUM_MATRIX_2026,
  frequency: "SEMI_MONTHLY",
  cutoffIndex: 0,
};

const emp: EmployeeInput = {
  id: 1,
  baseSalaryMonthly: 3_000_000,
  payFrequency: "SEMI_MONTHLY",
  isMinimumWageExempt: false,
  allowances: [],
};

function day(overrides: Partial<DayInput> = {}): DayInput {
  return {
    workDate: "2026-10-05",
    status: "PRESENT",
    holidayKind: "NONE",
    isRestDay: false,
    presenceBeforeHoliday: true,
    workedSeconds: 28_800,
    scheduledSeconds: 28_800,
    lateSeconds: 0,
    undertimeSeconds: 0,
    absentSeconds: 0,
    otWorkedSeconds: 0,
    nightSeconds: 0,
    nightOtSeconds: 0,
    ...overrides,
  };
}

describe("calcEmployee", () => {
  it("semi-monthly gross-to-net for a ₱30,000 employee", () => {
    const item = calcEmployee(emp, [], cfg);

    expect(item.basicPay).toBe(1_500_000);
    expect(item.sssEe + item.sssWispEe).toBe(75_000);
    expect(item.phicEe).toBe(37_500);
    expect(item.hdmfEe).toBe(10_000);
    expect(item.taxablePay).toBe(1_377_500);
    expect(item.birTax).toBe(50_375);
    expect(item.grossPay).toBe(1_500_000);
    expect(item.netPay).toBe(1_500_000 - 75_000 - 37_500 - 10_000 - 50_375);
    expect(item.status).toBe("CALCULATED");
  });

  it("worked regular holiday pays the 200% premium", () => {
    const item = calcEmployee(emp, [day({ holidayKind: "REGULAR" })], cfg);
    expect(item.holidayPay).toBe(136_364);
    expect(item.daysHolidayRh).toBe(1);
    expect(item.grossPay).toBe(1_500_000 + 136_364);
  });

  it("rest day worked pays the 130% premium", () => {
    const item = calcEmployee(emp, [day({ isRestDay: true })], cfg);
    expect(item.restDayPay).toBe(40_909);
    expect(item.grossPay).toBe(1_500_000 + 40_909);
  });

  it("night hours pay 10% NSD on the hourly rate", () => {
    const item = calcEmployee(
      emp,
      [day({ nightSeconds: 28_800 })],
      cfg,
    );
    expect(item.hoursNsd).toBe(8);
    expect(item.nsdPay).toBe(13_637);
  });

  it("invariants: gross and net always reconcile", () => {
    const item = calcEmployee(
      emp,
      [
        day({ holidayKind: "REGULAR", otWorkedSeconds: 3600, nightSeconds: 7200, nightOtSeconds: 3600 }),
        day({ workDate: "2026-10-06", status: "ABSENT", workedSeconds: 0, absentSeconds: 28_800 }),
        day({ workDate: "2026-10-07", isRestDay: true, lateSeconds: 900 }),
      ],
      cfg,
    );

    expect(item.grossPay).toBe(
      item.basicPay + item.otPay + item.nsdPay + item.holidayPay + item.restDayPay + item.otherEarnings,
    );
    expect(item.totalDeductions).toBe(
      item.sssEe + item.sssWispEe + item.phicEe + item.hdmfEe + item.birTax,
    );
    expect(item.netPay).toBe(Math.max(0, item.grossPay - item.totalDeductions));
    expect(item.daysWorked).toBe(2);
    expect(item.daysAbsent).toBe(1);
    expect(item.lateSeconds).toBe(900);
  });
});
