import { describe, expect, it } from "vitest";
import { splitPeriodAmount, dailyRate, hourlyRate, roundHalfUp } from "../money";
import { manilaToUtc, nightOverlapSeconds } from "../time";
import {
  ALLOWANCE_TYPES_2026,
  BIR_ANNUAL_2026,
  HDMF_2026,
  HOLIDAYS_2026,
  PHIC_2026,
  PAY_FREQUENCY_PERIODS,
  PREMIUM_MATRIX_2026,
  SSS_2026,
  birAnnualTax,
  birPeriodicTax,
  computeHdmf,
  computePhic,
  computeSss,
  mscFor,
  premiumFor,
} from "./ph";

const P = 100;

describe("money", () => {
  it("rounds half away from zero", () => {
    expect(roundHalfUp(0.5)).toBe(1);
    expect(roundHalfUp(-0.5)).toBe(-1);
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(2.4)).toBe(2);
  });

  it("splits so the parts always sum back to the whole", () => {
    for (const n of [2, 12, 24, 52, 261]) {
      for (const total of [1, 99, 100, 101, 8650000, 3000007]) {
        let sum = 0;
        for (let i = 0; i < n; i++) sum += splitPeriodAmount(total, i, n);
        expect(sum).toBe(total);
      }
    }
  });

  it("uses DOLE 22-day / 8-hour rates", () => {
    expect(dailyRate(220000)).toBe(10000);
    expect(hourlyRate(220000)).toBe(1250);
  });
});

describe("nsd", () => {
  const d = (m: number, day: number, h: number) => manilaToUtc(2026, m, day, h, 0);

  it("counts the full 22:00-06:00 band across midnight", () => {
    expect(nightOverlapSeconds(d(0, 1, 22), d(0, 2, 6))).toBe(8 * 3600);
  });

  it("counts only the night portion of a partial shift", () => {
    expect(nightOverlapSeconds(d(0, 1, 20), d(0, 2, 2))).toBe(4 * 3600);
    expect(nightOverlapSeconds(d(0, 1, 10), d(0, 1, 18))).toBe(0);
    expect(nightOverlapSeconds(d(0, 1, 6), d(0, 1, 22))).toBe(0);
  });

  it("excludes unpaid meal windows", () => {
    const meal: [number, number] = [
      manilaToUtc(2026, 0, 2, 0, 0),
      manilaToUtc(2026, 0, 2, 1, 0),
    ];
    expect(nightOverlapSeconds(d(0, 1, 22), d(0, 2, 6), [meal])).toBe(7 * 3600);
  });
});

describe("sss", () => {
  it("maps basic pay to MSC at the published band midpoints", () => {
    expect(mscFor(SSS_2026, 0)).toBe(500000);
    expect(mscFor(SSS_2026, 524999)).toBe(500000);
    expect(mscFor(SSS_2026, 525000)).toBe(550000);
    expect(mscFor(SSS_2026, 574999)).toBe(550000);
    expect(mscFor(SSS_2026, 575000)).toBe(600000);
    expect(mscFor(SSS_2026, 3474999)).toBe(3450000);
    expect(mscFor(SSS_2026, 3475000)).toBe(3500000);
    expect(mscFor(SSS_2026, 999999 * P)).toBe(3500000);
  });

  it("splits EE/ER 5%/10% and keeps WISP separate", () => {
    const r = computeSss(SSS_2026, 25000 * P);
    expect(r.msc).toBe(2500000);
    expect(r.regularEe).toBe(100000);
    expect(r.regularEr).toBe(200000);
    expect(r.wispEe).toBe(25000);
    expect(r.wispEr).toBe(50000);
    expect(r.regularEe + r.wispEe).toBe(r.totalEe);
    expect(r.totalEe).toBe(125000);
    expect(r.totalEr).toBe(253000);
  });

  it("puts all of MSC at or below threshold into the regular fund", () => {
    const r = computeSss(SSS_2026, 20000 * P);
    expect(r.msc).toBe(2000000);
    expect(r.wispEe).toBe(0);
    expect(r.wispEr).toBe(0);
    expect(r.totalEe).toBe(100000);
    expect(r.regularEr).toBe(200000);
  });

  it("applies the EC tiers", () => {
    expect(computeSss(SSS_2026, 4000 * P).ec).toBe(1000);
    expect(computeSss(SSS_2026, 14749 * P).ec).toBe(1000);
    expect(computeSss(SSS_2026, 15000 * P).ec).toBe(3000);
  });
});

describe("philhealth", () => {
  it("clamps the base to the floor and ceiling", () => {
    expect(computePhic(PHIC_2026, 5000 * P).base).toBe(1000000);
    expect(computePhic(PHIC_2026, 200000 * P).base).toBe(10000000);
    expect(computePhic(PHIC_2026, 50000 * P).base).toBe(5000000);
  });

  it("splits the premium 50/50 with no residual centavo", () => {
    for (const basic of [10000, 10000.5, 15000, 15000.33, 50000, 100000, 150000]) {
      const r = computePhic(PHIC_2026, basic * P);
      expect(r.ee + r.er).toBe(r.premium);
      expect(r.premium % 100).toBe(0);
      expect(r.ee).toBe(r.er);
    }
    const r = computePhic(PHIC_2026, 15000 * P);
    expect(r.premium).toBe(75000);
    expect(r.ee).toBe(37500);
  });
});

describe("pagibig", () => {
  it("caps the base at 10,000 and each side at 200", () => {
    const low = computeHdmf(HDMF_2026, 5000 * P);
    expect(low.ee).toBe(10000);
    expect(low.er).toBe(10000);
    const high = computeHdmf(HDMF_2026, 15000 * P);
    expect(high.ee).toBe(20000);
    expect(high.er).toBe(20000);
  });
});

describe("bir", () => {
  it("taxes each annual bracket boundary exactly", () => {
    expect(birAnnualTax(BIR_ANNUAL_2026, 25000000)).toBe(0);
    expect(birAnnualTax(BIR_ANNUAL_2026, 40000000)).toBe(2250000);
    expect(birAnnualTax(BIR_ANNUAL_2026, 80000000)).toBe(10250000);
    expect(birAnnualTax(BIR_ANNUAL_2026, 200000000)).toBe(40250000);
    expect(birAnnualTax(BIR_ANNUAL_2026, 800000000)).toBe(220250000);
    expect(birAnnualTax(BIR_ANNUAL_2026, 800000001)).toBe(220250000);
    expect(birAnnualTax(BIR_ANNUAL_2026, 0)).toBe(0);
    expect(birAnnualTax(BIR_ANNUAL_2026, -500)).toBe(0);
  });

  it("reproduces the spec worked example", () => {
    expect(birAnnualTax(BIR_ANNUAL_2026, 72000000)).toBe(8650000);
    expect(birPeriodicTax(BIR_ANNUAL_2026, "SEMI_MONTHLY", 30000 * P, 0)).toBe(360417);
  });

  it("sums back to the annual tax for every frequency", () => {
    for (const [freq, n] of Object.entries(PAY_FREQUENCY_PERIODS)) {
      for (const periodTaxable of [0, 1000, 500000, 1500000, 3000000]) {
        let sum = 0;
        for (let i = 0; i < n; i++) {
          sum += birPeriodicTax(
            BIR_ANNUAL_2026,
            freq as keyof typeof PAY_FREQUENCY_PERIODS,
            periodTaxable,
            i,
          );
        }
        expect(sum).toBe(birAnnualTax(BIR_ANNUAL_2026, periodTaxable * n));
      }
    }
  });
});

describe("premium matrix", () => {
  it("has one row per day-kind / rest / worked combination", () => {
    expect(PREMIUM_MATRIX_2026).toHaveLength(12);
    for (const kind of ["NONE", "REGULAR", "SPECIAL_NONWORKING"] as const) {
      for (const rest of [false, true]) {
        for (const worked of [false, true]) {
          expect(
            PREMIUM_MATRIX_2026.filter(
              (r) => r.holidayKind === kind && r.isRestDay === rest && r.worked === worked,
            ),
          ).toHaveLength(1);
        }
      }
    }
  });

  it("matches the DOLE minimum rates", () => {
    const m = (kind: "NONE" | "REGULAR" | "SPECIAL_NONWORKING", rest: boolean, worked: boolean) =>
      premiumFor(PREMIUM_MATRIX_2026, kind, rest, worked).first8hMultiplier;

    expect(m("NONE", false, true)).toBe(1.0);
    expect(m("NONE", true, true)).toBe(1.3);
    expect(m("SPECIAL_NONWORKING", false, true)).toBe(1.3);
    expect(m("SPECIAL_NONWORKING", true, true)).toBe(1.5);
    expect(m("REGULAR", false, true)).toBe(2.0);
    expect(m("REGULAR", true, true)).toBe(2.6);
  });

  it("pays an unworked regular holiday and nothing on an unworked special day", () => {
    expect(premiumFor(PREMIUM_MATRIX_2026, "REGULAR", false, false).payWhenUnworked).toBe(true);
    expect(premiumFor(PREMIUM_MATRIX_2026, "REGULAR", true, false).payWhenUnworked).toBe(true);
    expect(premiumFor(PREMIUM_MATRIX_2026, "SPECIAL_NONWORKING", false, false).payWhenUnworked).toBe(false);
    expect(premiumFor(PREMIUM_MATRIX_2026, "NONE", false, false).payWhenUnworked).toBe(false);
  });

  it("treats local and half-day kinds as special non-working", () => {
    expect(premiumFor(PREMIUM_MATRIX_2026, "LOCAL", false, true).first8hMultiplier).toBe(1.3);
    expect(premiumFor(PREMIUM_MATRIX_2026, "SPECIAL_HALF_DAY", false, true).first8hMultiplier).toBe(1.3);
  });

  it("never yields an OT hourly rate below the day's first-8-hour rate", () => {
    for (const r of PREMIUM_MATRIX_2026) {
      if (r.worked) expect(r.otHourMultiplier).toBeGreaterThanOrEqual(r.first8hMultiplier);
    }
  });
});

describe("seed data", () => {
  it("declares 18 holidays for 2026 with unique dates", () => {
    expect(HOLIDAYS_2026).toHaveLength(18);
    expect(new Set(HOLIDAYS_2026.map((h) => h.date)).size).toBe(18);
    expect(HOLIDAYS_2026.filter((h) => h.kind === "REGULAR")).toHaveLength(10);
    expect(HOLIDAYS_2026.every((h) => h.date.startsWith("2026-"))).toBe(true);
  });

  it("holds every de minimis benefit to its BIR ceiling", () => {
    const byCode = Object.fromEntries(ALLOWANCE_TYPES_2026.map((a) => [a.code, a]));
    expect(byCode.RICE.monthlyCap).toBe(150000);
    expect(byCode.CLOTHING.annualCap).toBe(600000);
    expect(byCode.MEDICAL.annualCap).toBe(1000000);
    expect(byCode.LAUNDRY.monthlyCap).toBe(30000);
    expect(byCode.GIFT.annualCap).toBe(900000);
    expect(byCode.ACHIEVE.annualCap).toBe(1000000);
    expect(byCode.RD_SUB.monthlyCap).toBe(100000);
    expect(ALLOWANCE_TYPES_2026.filter((a) => a.taxable).map((a) => a.code)).toEqual([
      "PERF_BONUS",
      "COLA",
    ]);
  });
});
