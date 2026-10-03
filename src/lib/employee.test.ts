import { describe, expect, it } from "vitest";
import { parseEmployee } from "@/lib/employee";
import { formatPhp, parsePhpToCents } from "@/lib/money";

function form(values: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) value.forEach((v) => fd.append(key, v));
    else fd.append(key, value);
  }
  return fd;
}

const VALID: Record<string, string | string[]> = {
  employeeNo: "E-0001",
  externalCode: "1001",
  firstName: "Juan",
  lastName: "Dela Cruz",
  dateHired: "2026-01-05",
  status: "ACTIVE",
  employmentType: "PROBATIONARY",
  payFrequency: "SEMI_MONTHLY",
  campaignId: "1",
  departmentId: "2",
  costCenterId: "3",
  positionId: "4",
  baseSalaryMonthly: "18000.00",
  weeklyRestDays: ["0"],
};

describe("parseEmployee", () => {
  it("parses a valid form into centavos and typed ids", () => {
    const result = parseEmployee(form(VALID));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.baseSalaryMonthly).toBe(1_800_000);
    expect(result.value.campaignId).toBe(1);
    expect(result.value.departmentId).toBe(2);
    expect(result.value.weeklyRestDays).toEqual([0]);
    expect(result.value.email).toBeNull();
    expect(result.value.reportsToId).toBeNull();
    expect(result.value.isMinimumWageExempt).toBe(false);
  });

  it("accepts formatted salaries", () => {
    const result = parseEmployee(form({ ...VALID, baseSalaryMonthly: "₱18,000.50" }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.baseSalaryMonthly).toBe(1_800_050);
  });

  it("rejects an unparseable salary", () => {
    const result = parseEmployee(form({ ...VALID, baseSalaryMonthly: "ask" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.baseSalaryMonthly).toBeTruthy();
  });

  it("rejects negative salaries", () => {
    const result = parseEmployee(form({ ...VALID, baseSalaryMonthly: "-1" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.baseSalaryMonthly).toBeTruthy();
  });

  it("requires the core identity fields", () => {
    const result = parseEmployee(form({ ...VALID, lastName: "", employeeNo: "" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.lastName).toBeTruthy();
      expect(result.errors.employeeNo).toBeTruthy();
    }
  });

  it("requires at least one rest day", () => {
    const result = parseEmployee(form({ ...VALID, weeklyRestDays: [] }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.weeklyRestDays).toBeTruthy();
  });

  it("rejects a separation date before the hire date", () => {
    const result = parseEmployee(form({ ...VALID, dateSeparated: "2025-12-31" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.dateSeparated).toBeTruthy();
  });

  it("rejects unknown enum values", () => {
    const result = parseEmployee(form({ ...VALID, status: "FIRED" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.status).toBeTruthy();
  });

  it("rejects a malformed email but allows a blank one", () => {
    const blank = parseEmployee(form({ ...VALID, email: "" }));
    expect(blank.ok).toBe(true);

    const bad = parseEmployee(form({ ...VALID, email: "not-an-email" }));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.email).toBeTruthy();
  });

  it("deduplicates and sorts rest days", () => {
    const result = parseEmployee(form({ ...VALID, weeklyRestDays: ["6", "0", "6"] }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.weeklyRestDays).toEqual([0, 6]);
  });
});

describe("money helpers", () => {
  it("round-trips pesos through centavos", () => {
    expect(parsePhpToCents("18000.00")).toBe(1_800_000);
    expect(parsePhpToCents("₱18,000.50")).toBe(1_800_050);
    expect(parsePhpToCents("18000.675")).toBeNull();
    expect(parsePhpToCents("abc")).toBeNull();
    expect(parsePhpToCents("")).toBeNull();
  });

  it("formats centavos in Philippine pesos", () => {
    expect(formatPhp(1_800_000)).toBe("₱18,000.00");
    expect(formatPhp(0)).toBe("₱0.00");
  });
});
