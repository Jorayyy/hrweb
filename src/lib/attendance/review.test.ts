import { describe, expect, it } from "vitest";
import {
  addDays,
  mondayOf,
  requiredDates,
  unreviewedOffenders,
  weekReadiness,
} from "./review";

describe("mondayOf", () => {
  it("snaps any day back to its Monday", () => {
    expect(mondayOf("2026-10-05")).toBe("2026-10-05"); // Monday
    expect(mondayOf("2026-10-11")).toBe("2026-10-05"); // Sunday
    expect(mondayOf("2026-09-30")).toBe("2026-09-28"); // Wednesday
  });
});

describe("addDays", () => {
  it("crosses month boundaries", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-10-05", -7)).toBe("2026-09-28");
  });
});

describe("requiredDates", () => {
  it("excludes weekly rest days", () => {
    // Mon 2026-09-28 .. Sun 2026-10-04, rest day Saturday (6)
    const dates = requiredDates({
      from: "2026-09-28",
      to: "2026-10-04",
      dateHired: "2026-01-01",
      weeklyRestDays: [6],
    });
    expect(dates).toHaveLength(6);
    expect(dates).not.toContain("2026-10-03");
  });

  it("starts at dateHired for mid-week hires", () => {
    const dates = requiredDates({
      from: "2026-09-28",
      to: "2026-10-04",
      dateHired: "2026-10-01",
      weeklyRestDays: [],
    });
    expect(dates[0]).toBe("2026-10-01");
    expect(dates).toHaveLength(4);
  });

  it("returns nothing when hired after the range", () => {
    expect(
      requiredDates({
        from: "2026-09-28",
        to: "2026-10-04",
        dateHired: "2026-10-10",
        weeklyRestDays: [],
      }),
    ).toEqual([]);
  });
});

describe("weekReadiness", () => {
  const required = ["2026-09-28", "2026-09-29", "2026-09-30"];
  const row = (workDate: string, needsReview = false, reviewed = true) => ({
    workDate,
    needsReview,
    reviewedAt: reviewed ? new Date() : null,
  });

  it("is approved when every required day exists and is reviewed", () => {
    const r = weekReadiness(required, required.map((d) => row(d)));
    expect(r).toEqual({ ready: true, missing: [], flagged: [], approved: true });
  });

  it("blocks on missing days", () => {
    const r = weekReadiness(required, [row(required[0]), row(required[1])]);
    expect(r.ready).toBe(false);
    expect(r.missing).toEqual(["2026-09-30"]);
    expect(r.approved).toBe(false);
  });

  it("blocks on needsReview flags even when present", () => {
    const r = weekReadiness(required, [
      row(required[0]),
      row(required[1], true),
      row(required[2]),
    ]);
    expect(r.ready).toBe(false);
    expect(r.flagged).toEqual(["2026-09-29"]);
  });

  it("is ready but not approved when days exist unreviewed", () => {
    const r = weekReadiness(required, [
      row(required[0]),
      row(required[1]),
      row(required[2], false, false),
    ]);
    expect(r.ready).toBe(true);
    expect(r.approved).toBe(false);
  });
});

describe("unreviewedOffenders", () => {
  const period = { dateFrom: "2026-09-28", dateTo: "2026-10-04" };
  const empA = { id: 1, employeeNo: "E-0001", dateHired: "2026-01-01", weeklyRestDays: [6] };
  const empB = { id: 2, employeeNo: "E-0002", dateHired: "2026-01-01", weeklyRestDays: [0] };
  const allDatesA = [
    "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-04",
  ];
  const allDatesB = [
    "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03",
  ];
  const reviewed = (empId: number, dates: string[]) =>
    dates.map((d) => ({ employeeId: empId, workDate: d, reviewedAt: new Date() }));

  it("passes when every required day is reviewed", () => {
    const rows = [...reviewed(1, allDatesA), ...reviewed(2, allDatesB)];
    expect(unreviewedOffenders([empA, empB], period, rows)).toEqual([]);
  });

  it("flags an employee with no rows at all", () => {
    expect(unreviewedOffenders([empA, empB], period, reviewed(1, allDatesA))).toEqual(["E-0002"]);
  });

  it("flags a single unreviewed day", () => {
    const rows = [...reviewed(1, allDatesA), ...reviewed(2, allDatesB.slice(0, -1))];
    expect(unreviewedOffenders([empA, empB], period, rows)).toEqual(["E-0002"]);
  });

  it("ignores rest days and pre-hire dates", () => {
    const hires = [{ ...empA, dateHired: "2026-10-01" }];
    const rows = [
      { employeeId: 1, workDate: "2026-10-01", reviewedAt: new Date() },
      { employeeId: 1, workDate: "2026-10-02", reviewedAt: new Date() },
      { employeeId: 1, workDate: "2026-10-04", reviewedAt: new Date() },
    ];
    expect(unreviewedOffenders(hires, period, rows)).toEqual([]);
  });
});
