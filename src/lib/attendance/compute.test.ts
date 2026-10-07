import { describe, expect, it } from "vitest";
import { computeDay, type PunchSet, type ShiftTemplateInput } from "./compute";
import { manilaToUtc } from "@/lib/time";

const DAY = "2026-10-05";

const DAY_SHIFT: ShiftTemplateInput = {
  startsAt: "08:00",
  endsAt: "17:00",
  break1Start: "10:00",
  break1End: "10:15",
  lunchStart: "12:00",
  lunchEnd: "13:00",
  break2Start: "15:00",
  break2End: "15:15",
};

const NIGHT_SHIFT: ShiftTemplateInput = {
  startsAt: "22:00",
  endsAt: "06:00",
  break1Start: "23:30",
  break1End: "23:45",
  lunchStart: "01:00",
  lunchEnd: "02:00",
  break2Start: "04:00",
  break2End: "04:15",
};

function t(hhmm: string, dayOffset = 0): Date {
  const [y, m, d] = DAY.split("-").map(Number);
  const [h, min] = hhmm.split(":").map(Number);
  return new Date(manilaToUtc(y, m - 1, d + dayOffset, h, min));
}

const fullPunches = (over: Partial<PunchSet> = {}): PunchSet => ({
  inUtc: t("08:00"),
  break1OutUtc: t("10:00"),
  break1InUtc: t("10:15"),
  lunchOutUtc: t("12:00"),
  lunchInUtc: t("13:00"),
  break2OutUtc: t("15:00"),
  break2InUtc: t("15:15"),
  outUtc: t("17:00"),
  ...over,
});

describe("computeDay", () => {
  it("computes a clean 8-5 day: 8h scheduled, 8h worked, no flags", () => {
    const r = computeDay(DAY, DAY_SHIFT, fullPunches());
    expect(r.scheduledSeconds).toBe(8 * 3600);
    expect(r.workedSeconds).toBe(8 * 3600);
    expect(r.paidBreakSeconds).toBe(30 * 60);
    expect(r.lateSeconds).toBe(0);
    expect(r.otWorkedSeconds).toBe(0);
    expect(r.undertimeSeconds).toBe(0);
    expect(r.complete).toBe(true);
    expect(r.needsReview).toBe(false);
    expect(r.reviewNote).toBeNull();
  });

  it("flags late arrival and overtime beyond shift end", () => {
    const r = computeDay(DAY, DAY_SHIFT, fullPunches({ inUtc: t("08:15"), outUtc: t("18:30") }));
    expect(r.lateSeconds).toBe(15 * 60);
    expect(r.otWorkedSeconds).toBe(90 * 60);
    expect(r.workedSeconds).toBe(9 * 3600 + 15 * 60);
    expect(r.nightSeconds).toBe(0);
    expect(r.nightOtSeconds).toBe(0);
  });

  it("absorbs lateness within the grace period and deducts only the excess", () => {
    const early = fullPunches({ inUtc: t("08:03") });
    expect(computeDay(DAY, DAY_SHIFT, early).lateSeconds).toBe(3 * 60);
    expect(computeDay(DAY, DAY_SHIFT, early, { graceSeconds: 5 * 60 }).lateSeconds).toBe(0);

    const late = fullPunches({ inUtc: t("08:08") });
    expect(computeDay(DAY, DAY_SHIFT, late, { graceSeconds: 5 * 60 }).lateSeconds).toBe(3 * 60);
  });

  it("floors overtime down to the configured rounding increment", () => {
    const punches = fullPunches({ outUtc: t("18:17") });
    expect(computeDay(DAY, DAY_SHIFT, punches).otWorkedSeconds).toBe(77 * 60);
    expect(
      computeDay(DAY, DAY_SHIFT, punches, { otRoundSeconds: 15 * 60 }).otWorkedSeconds,
    ).toBe(75 * 60);
    expect(
      computeDay(DAY, DAY_SHIFT, punches, { otRoundSeconds: 5 * 60 }).otWorkedSeconds,
    ).toBe(75 * 60);
  });

  it("deducts an over-long lunch from worked time and notes the variance", () => {
    const r = computeDay(DAY, DAY_SHIFT, fullPunches({ lunchInUtc: t("13:20") }));
    expect(r.workedSeconds).toBe(8 * 3600 - 20 * 60);
    expect(r.needsReview).toBe(true);
    expect(r.reviewNote).toContain("Lunch 20m over");
  });

  it("handles an overnight 22:00-06:00 shift with night seconds", () => {
    const r = computeDay(DAY, NIGHT_SHIFT, {
      inUtc: t("22:00"),
      break1OutUtc: t("23:30"),
      break1InUtc: t("23:45"),
      lunchOutUtc: t("01:00", 1),
      lunchInUtc: t("02:00", 1),
      break2OutUtc: t("04:00", 1),
      break2InUtc: t("04:15", 1),
      outUtc: t("06:00", 1),
    });
    expect(r.scheduledSeconds).toBe(7 * 3600);
    expect(r.workedSeconds).toBe(7 * 3600);
    expect(r.lateSeconds).toBe(0);
    expect(r.otWorkedSeconds).toBe(0);
    expect(r.nightSeconds).toBe(7 * 3600);
    expect(r.nightOtSeconds).toBe(0);
    expect(r.needsReview).toBe(false);
  });

  it("treats a missing punch out as incomplete with zero worked time", () => {
    const r = computeDay(DAY, DAY_SHIFT, fullPunches({ outUtc: null, break2OutUtc: null, break2InUtc: null }));
    expect(r.complete).toBe(false);
    expect(r.workedSeconds).toBe(0);
    expect(r.needsReview).toBe(true);
    expect(r.reviewNote).toContain("Missing punch out");
  });

  it("counts night overtime when an evening shift runs past 22:00", () => {
    const evening: ShiftTemplateInput = {
      startsAt: "14:00",
      endsAt: "23:00",
      break1Start: "16:00",
      break1End: "16:15",
      lunchStart: "18:00",
      lunchEnd: "19:00",
      break2Start: "21:00",
      break2End: "21:15",
    };
    const r = computeDay(DAY, evening, fullPunches({
      inUtc: t("14:00"),
      break1OutUtc: t("16:00"),
      break1InUtc: t("16:15"),
      lunchOutUtc: t("18:00"),
      lunchInUtc: t("19:00"),
      break2OutUtc: t("21:00"),
      break2InUtc: t("21:15"),
      outUtc: t("01:00", 1),
    }));
    expect(r.otWorkedSeconds).toBe(2 * 3600);
    expect(r.nightSeconds).toBe(3 * 3600);
    expect(r.nightOtSeconds).toBe(2 * 3600);
  });

  it("handles a shift with no 1st/2nd breaks: no break notes, lunch still tracked", () => {
    const r = computeDay(
      DAY,
      { ...DAY_SHIFT, break1Start: null, break1End: null, break2Start: null, break2End: null },
      {
        inUtc: t("08:00"),
        break1OutUtc: null,
        break1InUtc: null,
        lunchOutUtc: t("12:00"),
        lunchInUtc: t("13:00"),
        break2OutUtc: null,
        break2InUtc: null,
        outUtc: t("17:00"),
      },
    );
    expect(r.scheduledSeconds).toBe(8 * 3600);
    expect(r.workedSeconds).toBe(8 * 3600);
    expect(r.paidBreakSeconds).toBe(0);
    expect(r.needsReview).toBe(false);
    expect(r.reviewNote).toBeNull();
  });
});
