import { describe, expect, it } from "vitest";
import { hasScope, parseRunScope, payFamilyFor, runEmployeeConditions } from "./scope";

function form(entries: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) {
    for (const one of Array.isArray(v) ? v : [v]) fd.append(k, one);
  }
  return fd;
}

describe("payFamilyFor", () => {
  it("maps a cutoff to its pay frequencies", () => {
    expect(payFamilyFor("WEEKLY")).toEqual(["WEEKLY", "DAILY"]);
    expect(payFamilyFor("SEMI_MONTHLY")).toEqual(["SEMI_MONTHLY", "MONTHLY"]);
    expect(payFamilyFor("MONTHLY")).toEqual(["SEMI_MONTHLY", "MONTHLY"]);
  });
});

describe("hasScope", () => {
  it("is false for null and for empty dimensions", () => {
    expect(hasScope(null)).toBe(false);
    expect(hasScope({})).toBe(false);
    expect(hasScope({ campaignIds: [] })).toBe(false);
    expect(hasScope({ campaignIds: [1] })).toBe(true);
    expect(hasScope({ costCenterIds: [2] })).toBe(true);
  });
});

describe("parseRunScope", () => {
  it("returns null when nothing is selected", () => {
    expect(parseRunScope(form({}))).toBeNull();
    expect(parseRunScope(form({ campaignIds: [] }))).toBeNull();
  });

  it("keeps only valid positive integer ids", () => {
    const scope = parseRunScope(
      form({ campaignIds: ["7", "abc", "-1", "0"], departmentIds: ["3"], costCenterIds: ["9"] }),
    );
    expect(scope).toEqual({ campaignIds: [7], departmentIds: [3], costCenterIds: [9] });
  });

  it("drops dimensions that ended up empty", () => {
    const scope = parseRunScope(form({ campaignIds: ["nope"], departmentIds: ["5"] }));
    expect(scope).toEqual({ departmentIds: [5] });
  });
});

describe("runEmployeeConditions", () => {
  it("always filters on status and pay family", () => {
    const conds = runEmployeeConditions("WEEKLY", null);
    expect(conds).toHaveLength(2);
  });

  it("adds one condition per non-empty scope dimension", () => {
    expect(runEmployeeConditions("SEMI_MONTHLY", { campaignIds: [1, 2] })).toHaveLength(3);
    expect(
      runEmployeeConditions("SEMI_MONTHLY", {
        campaignIds: [1],
        departmentIds: [2],
        costCenterIds: [3],
      }),
    ).toHaveLength(5);
    expect(runEmployeeConditions("SEMI_MONTHLY", { campaignIds: [] })).toHaveLength(2);
  });
});
