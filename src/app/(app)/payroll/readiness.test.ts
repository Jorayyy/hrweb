import { describe, expect, it } from "vitest";
import { blockingFailures, reconcileTotals, type Check } from "./readiness";

const check = (over: Partial<Check>): Check => ({
  key: "k",
  label: "label",
  ok: true,
  blocking: true,
  detail: "",
  ...over,
});

describe("blockingFailures", () => {
  it("keeps only failing blocking checks", () => {
    const checks = [
      check({ key: "a", ok: true }),
      check({ key: "b", ok: false, blocking: true }),
      check({ key: "c", ok: false, blocking: false }),
    ];
    expect(blockingFailures(checks).map((c) => c.key)).toEqual(["b"]);
  });
});

describe("reconcileTotals", () => {
  const run = { grossTotal: 300_000, deductionTotal: 50_000, netTotal: 250_000 };
  const rows = [
    { grossPay: 200_000, totalDeductions: 30_000, netPay: 170_000 },
    { grossPay: 100_000, totalDeductions: 20_000, netPay: 80_000 },
  ];

  it("passes when register sums equal stored run totals", () => {
    expect(reconcileTotals(rows, run).ok).toBe(true);
  });

  it("fails when any stored total drifts", () => {
    expect(reconcileTotals(rows, { ...run, netTotal: 249_999 }).ok).toBe(false);
    expect(reconcileTotals(rows, { ...run, grossTotal: 1 }).detail).toContain("gross");
  });

  it("fails on an empty or uncalculated run", () => {
    expect(reconcileTotals([], run).ok).toBe(false);
    expect(reconcileTotals(rows, { grossTotal: null, deductionTotal: null, netTotal: null }).ok).toBe(
      false,
    );
  });
});
