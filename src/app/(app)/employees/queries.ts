import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  campaign,
  costCenter,
  department,
  employee,
  employmentStatus,
  employmentType,
  jobPosition,
  payFrequency,
} from "@/db/schema";

type Option = { value: string; label: string };

function humanize(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

function enumOptions(values: readonly string[]): Option[] {
  return values.map((v) => ({ value: v, label: humanize(v) }));
}

export const ENUM_OPTIONS = {
  status: enumOptions(employmentStatus.enumValues),
  employmentType: enumOptions(employmentType.enumValues),
  payFrequency: enumOptions(payFrequency.enumValues),
};

export type EmployeeSelects = {
  campaigns: Option[];
  departments: Option[];
  costCenters: Option[];
  positions: Option[];
  managers: Option[];
};

const asOption = ({ id, code, name }: { id: number; code: string; name: string }): Option => ({
  value: String(id),
  label: `${code} — ${name}`,
});

export async function employeeSelects(): Promise<EmployeeSelects> {
  const [campaigns, departments, costCenters, positions, managers] = await Promise.all([
    db
      .select({ id: campaign.id, code: campaign.code, name: campaign.name })
      .from(campaign)
      .where(eq(campaign.isActive, true))
      .orderBy(asc(campaign.code)),
    db
      .select({ id: department.id, code: department.code, name: department.name })
      .from(department)
      .orderBy(asc(department.code)),
    db
      .select({ id: costCenter.id, code: costCenter.code, name: costCenter.name })
      .from(costCenter)
      .where(eq(costCenter.isActive, true))
      .orderBy(asc(costCenter.code)),
    db
      .select({ id: jobPosition.id, code: jobPosition.code, name: jobPosition.title })
      .from(jobPosition)
      .orderBy(asc(jobPosition.jobLevel), asc(jobPosition.code)),
    db
      .select({ id: employee.id, lastName: employee.lastName, firstName: employee.firstName })
      .from(employee)
      .where(eq(employee.status, "ACTIVE"))
      .orderBy(asc(employee.lastName), asc(employee.firstName))
      .limit(300),
  ]);

  return {
    campaigns: campaigns.map(asOption),
    departments: departments.map(asOption),
    costCenters: costCenters.map(asOption),
    positions: positions.map(asOption),
    managers: managers.map((m) => ({
      value: String(m.id),
      label: `${m.lastName}, ${m.firstName}`,
    })),
  };
}
