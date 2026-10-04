import { employmentStatus, employmentType, payFrequency } from "@/db/schema";
import { field, fieldList, intOrNull, isIsoDate, oneOf } from "@/lib/form";
import { parsePhpToCents } from "@/lib/money";

export type EmployeeInput = {
  employeeNo: string;
  externalCode: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string | null;
  dateHired: string;
  dateRegularized: string | null;
  dateSeparated: string | null;
  status: (typeof employmentStatus.enumValues)[number];
  employmentType: (typeof employmentType.enumValues)[number];
  payFrequency: (typeof payFrequency.enumValues)[number];
  campaignId: number;
  departmentId: number;
  costCenterId: number;
  positionId: number;
  reportsToId: number | null;
  baseSalaryMonthly: number;
  tinNo: string | null;
  sssNo: string | null;
  philhealthNo: string | null;
  pagibigNo: string | null;
  rdoCode: string | null;
  bundyPin: string | null;
  isMinimumWageExempt: boolean;
  isManagerialTaxTbl: boolean;
  weeklyRestDays: number[];
};

export type ParseResult =
  | { ok: true; value: EmployeeInput }
  | { ok: false; errors: Record<string, string> };

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const OPTIONAL_TEXT = ["middleName", "email", "tinNo", "sssNo", "philhealthNo", "pagibigNo", "rdoCode"];
const REQUIRED_TEXT: [string, string][] = [
  ["employeeNo", "Employee no. is required."],
  ["externalCode", "Biometric code is required."],
  ["firstName", "First name is required."],
  ["lastName", "Last name is required."],
];
const REQUIRED_INT: [string, string][] = [
  ["campaignId", "Campaign is required."],
  ["departmentId", "Department is required."],
  ["costCenterId", "Cost center is required."],
  ["positionId", "Position is required."],
];

export function parseEmployee(formData: FormData): ParseResult {
  const errors: Record<string, string> = {};
  const text: Record<string, string> = {};

  for (const name of [...REQUIRED_TEXT.map(([k]) => k), ...OPTIONAL_TEXT]) {
    text[name] = field(formData, name);
  }
  for (const [name, message] of REQUIRED_TEXT) {
    if (!text[name]) errors[name] = message;
  }
  if (text.email && !EMAIL.test(text.email)) errors.email = "Enter a valid email address.";

  const dateHired = field(formData, "dateHired");
  if (!isIsoDate(dateHired)) errors.dateHired = "Date hired is required (YYYY-MM-DD).";

  for (const name of ["dateRegularized", "dateSeparated"]) {
    const value = field(formData, name);
    if (value && !isIsoDate(value)) errors[name] = "Use the format YYYY-MM-DD.";
    else if (value && isIsoDate(dateHired) && value < dateHired) {
      errors[name] = "Cannot be earlier than the date hired.";
    }
  }

  const empStatus = field(formData, "status");
  const empType = field(formData, "employmentType");
  const payFreq = field(formData, "payFrequency");
  if (!oneOf(empStatus, employmentStatus.enumValues)) errors.status = "Unknown status.";
  if (!oneOf(empType, employmentType.enumValues)) errors.employmentType = "Unknown employment type.";
  if (!oneOf(payFreq, payFrequency.enumValues)) errors.payFrequency = "Unknown pay frequency.";

  const ids: Record<string, number | null> = {};
  for (const [name, message] of REQUIRED_INT) {
    ids[name] = intOrNull(field(formData, name));
    if (ids[name] === null) errors[name] = message;
  }
  const reportsToId = intOrNull(field(formData, "reportsToId"));
  if (field(formData, "reportsToId") && reportsToId === null) errors.reportsToId = "Unknown employee.";

  const salary = parsePhpToCents(field(formData, "baseSalaryMonthly"));
  if (salary === null) errors.baseSalaryMonthly = "Enter a valid amount, e.g. 18000.00";
  else if (salary < 0) errors.baseSalaryMonthly = "Salary cannot be negative.";

  const bundyPin = field(formData, "bundyPin");
  if (bundyPin && !/^\d{4,6}$/.test(bundyPin)) errors.bundyPin = "PIN must be 4–6 digits.";

  const restDays = fieldList(formData, "weeklyRestDays")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  if (restDays.length === 0) errors.weeklyRestDays = "Select at least one rest day.";
  const uniqueRestDays = [...new Set(restDays)].sort((a, b) => a - b);

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      employeeNo: text.employeeNo,
      externalCode: text.externalCode,
      firstName: text.firstName,
      middleName: text.middleName || null,
      lastName: text.lastName,
      email: text.email || null,
      dateHired,
      dateRegularized: field(formData, "dateRegularized") || null,
      dateSeparated: field(formData, "dateSeparated") || null,
      status: empStatus as EmployeeInput["status"],
      employmentType: empType as EmployeeInput["employmentType"],
      payFrequency: payFreq as EmployeeInput["payFrequency"],
      campaignId: ids.campaignId as number,
      departmentId: ids.departmentId as number,
      costCenterId: ids.costCenterId as number,
      positionId: ids.positionId as number,
      reportsToId,
      baseSalaryMonthly: salary as number,
      tinNo: text.tinNo || null,
      sssNo: text.sssNo || null,
      philhealthNo: text.philhealthNo || null,
      pagibigNo: text.pagibigNo || null,
      rdoCode: text.rdoCode || null,
      bundyPin: bundyPin || null,
      isMinimumWageExempt: formData.get("isMinimumWageExempt") === "on",
      isManagerialTaxTbl: formData.get("isManagerialTaxTbl") === "on",
      weeklyRestDays: uniqueRestDays,
    },
  };
}
