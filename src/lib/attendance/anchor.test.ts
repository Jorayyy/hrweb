import { describe, expect, it } from "vitest";
import { dateKeyDayOfWeek, resolveAnchorDate } from "./anchor";

const TODAY = "2026-10-06";
const PREV = "2026-10-05";

describe("resolveAnchorDate", () => {
  it("keeps IN punches (no prerequisite) on today", () => {
    const day = { date: TODAY, hasPrereq: true, hasSlot: false };
    expect(resolveAnchorDate(false, day, { date: PREV, hasPrereq: true, hasSlot: false })).toBe(TODAY);
  });

  it("keeps a normal daytime OUT on today's row", () => {
    const today = { date: TODAY, hasPrereq: true, hasSlot: false };
    expect(resolveAnchorDate(true, today, null)).toBe(TODAY);
  });

  it("anchors OUT after midnight to yesterday's open shift", () => {
    const today = { date: TODAY, hasPrereq: false, hasSlot: false };
    const prev = { date: PREV, hasPrereq: true, hasSlot: false };
    expect(resolveAnchorDate(true, today, prev)).toBe(PREV);
  });

  it("reports a duplicate OUT against yesterday's row", () => {
    const today = { date: TODAY, hasPrereq: false, hasSlot: false };
    const prev = { date: PREV, hasPrereq: true, hasSlot: true };
    expect(resolveAnchorDate(true, today, prev)).toBe(PREV);
  });

  it("fails to today when no row anywhere has the prerequisite", () => {
    const today = { date: TODAY, hasPrereq: false, hasSlot: false };
    const prev = { date: PREV, hasPrereq: false, hasSlot: false };
    expect(resolveAnchorDate(true, today, prev)).toBe(TODAY);
  });

  it("anchors an overnight break punch to yesterday", () => {
    const today = { date: TODAY, hasPrereq: false, hasSlot: false };
    const prev = { date: PREV, hasPrereq: true, hasSlot: false };
    expect(resolveAnchorDate(true, today, prev)).toBe(PREV);
  });

  it("prefers today when today's row already has the prerequisite", () => {
    const today = { date: TODAY, hasPrereq: true, hasSlot: false };
    const prev = { date: PREV, hasPrereq: true, hasSlot: false };
    expect(resolveAnchorDate(true, today, prev)).toBe(TODAY);
  });

  it("prefers today when today's row already recorded the slot", () => {
    const today = { date: TODAY, hasPrereq: false, hasSlot: true };
    const prev = { date: PREV, hasPrereq: true, hasSlot: false };
    expect(resolveAnchorDate(true, today, prev)).toBe(TODAY);
  });
});

describe("dateKeyDayOfWeek", () => {
  it("returns the Postgres dow of the Manila date", () => {
    expect(dateKeyDayOfWeek("2026-10-05")).toBe(1);
    expect(dateKeyDayOfWeek("2026-10-11")).toBe(0);
  });
});
