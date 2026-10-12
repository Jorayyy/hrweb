import { describe, expect, it } from "vitest";
import { enumerateDays, rangesOverlap, workdays } from "./leave";

describe("enumerateDays", () => {
  it("is inclusive of both ends", () => {
    expect(enumerateDays("2026-01-01", "2026-01-03")).toEqual(["2026-01-01", "2026-01-02", "2026-01-03"]);
  });

  it("handles a single-day range", () => {
    expect(enumerateDays("2026-01-01", "2026-01-01")).toEqual(["2026-01-01"]);
  });
});

describe("workdays", () => {
  // 2026-01-01 is a Thursday. Week: Thu 1, Fri 2, Sat 3, Sun 4, Mon 5.
  it("drops Sat/Sun rest days", () => {
    expect(workdays("2026-01-01", "2026-01-05", [0, 6], new Set())).toEqual([
      "2026-01-01",
      "2026-01-02",
      "2026-01-05",
    ]);
  });

  it("honors custom rest days", () => {
    // Rest Thu(4)+Fri(5) → drops 2026-01-01(Thu), 01-02(Fri); keeps Sat+Sun+Mon.
    expect(workdays("2026-01-01", "2026-01-05", [4, 5], new Set())).toEqual([
      "2026-01-03",
      "2026-01-04",
      "2026-01-05",
    ]);
  });

  it("drops holidays even mid-week", () => {
    expect(workdays("2026-01-01", "2026-01-02", [0, 6], new Set(["2026-01-01"]))).toEqual(["2026-01-02"]);
  });
});

describe("rangesOverlap", () => {
  it("flags intersecting ranges", () => {
    expect(rangesOverlap("2026-01-01", "2026-01-10", "2026-01-10", "2026-01-15")).toBe(true);
    expect(rangesOverlap("2026-01-01", "2026-01-10", "2026-01-05", "2026-01-06")).toBe(true);
  });

  it("allows touching-but-not-overlapping ranges", () => {
    expect(rangesOverlap("2026-01-01", "2026-01-05", "2026-01-06", "2026-01-10")).toBe(false);
  });
});
