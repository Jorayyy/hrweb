"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bundyIp, campaign, costCenter, department, jobPosition } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { field, intOrNull, type FormState } from "@/lib/form";

const CODE = /^[A-Z0-9._-]{2,32}$/;

function codeError(code: string): string | null {
  if (!code) return "Code is required.";
  if (!CODE.test(code)) return "Use 2–32 chars: A–Z, 0–9, dot, underscore, hyphen.";
  return null;
}

export async function addCostCenter(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("ADMIN", "HR");

  const code = field(formData, "code").toUpperCase();
  const name = field(formData, "name");
  const errors: Record<string, string> = {};
  const codeProblem = codeError(code);
  if (codeProblem) errors.code = codeProblem;
  if (!name) errors.name = "Name is required.";
  if (Object.keys(errors).length > 0) return { errors };

  const [row] = await db
    .insert(costCenter)
    .values({ code, name })
    .onConflictDoNothing()
    .returning({ id: costCenter.id });
  if (!row) return { errors: { code: "That code already exists." } };

  revalidatePath("/setup");
  return null;
}

export async function addCampaign(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("ADMIN", "HR");

  const code = field(formData, "code").toUpperCase();
  const name = field(formData, "name");
  const clientName = field(formData, "clientName");
  const costCenterId = intOrNull(field(formData, "costCenterId"));
  const errors: Record<string, string> = {};
  const codeProblem = codeError(code);
  if (codeProblem) errors.code = codeProblem;
  if (!name) errors.name = "Name is required.";
  if (!clientName) errors.clientName = "Client name is required.";
  if (costCenterId === null) errors.costCenterId = "Cost center is required.";
  if (Object.keys(errors).length > 0) return { errors };

  const [row] = await db
    .insert(campaign)
    .values({ code, name, clientName, costCenterId: costCenterId as number })
    .onConflictDoNothing()
    .returning({ id: campaign.id });
  if (!row) return { errors: { code: "That code already exists." } };

  revalidatePath("/setup");
  return null;
}

export async function addDepartment(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("ADMIN", "HR");

  const code = field(formData, "code").toUpperCase();
  const name = field(formData, "name");
  const costCenterId = intOrNull(field(formData, "costCenterId"));
  const errors: Record<string, string> = {};
  const codeProblem = codeError(code);
  if (codeProblem) errors.code = codeProblem;
  if (!name) errors.name = "Name is required.";
  if (costCenterId === null) errors.costCenterId = "Cost center is required.";
  if (Object.keys(errors).length > 0) return { errors };

  const [row] = await db
    .insert(department)
    .values({ code, name, costCenterId: costCenterId as number })
    .onConflictDoNothing()
    .returning({ id: department.id });
  if (!row) return { errors: { code: "That code already exists." } };

  revalidatePath("/setup");
  return null;
}

export async function addJobPosition(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("ADMIN", "HR");

  const code = field(formData, "code").toUpperCase();
  const title = field(formData, "title");
  const jobLevel = intOrNull(field(formData, "jobLevel")) ?? 1;
  const errors: Record<string, string> = {};
  const codeProblem = codeError(code);
  if (codeProblem) errors.code = codeProblem;
  if (!title) errors.title = "Title is required.";
  if (jobLevel < 1 || jobLevel > 99) errors.jobLevel = "Level must be 1–99.";
  if (Object.keys(errors).length > 0) return { errors };

  const [row] = await db
    .insert(jobPosition)
    .values({ code, title, jobLevel, isManagerial: formData.get("isManagerial") === "on" })
    .onConflictDoNothing()
    .returning({ id: jobPosition.id });
  if (!row) return { errors: { code: "That code already exists." } };

  revalidatePath("/setup");
  return null;
}

const IPV4 = /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

export async function addBundyIp(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("ADMIN", "HR");

  const ip = field(formData, "ip");
  const label = field(formData, "label");
  const errors: Record<string, string> = {};
  if (!IPV4.test(ip)) errors.ip = "Enter a valid IPv4 address, e.g. 112.198.100.7.";
  if (!label) errors.label = "Label is required.";
  if (Object.keys(errors).length > 0) return { errors };

  const [row] = await db
    .insert(bundyIp)
    .values({ ip, label })
    .onConflictDoNothing()
    .returning({ id: bundyIp.id });
  if (!row) return { errors: { ip: "That IP is already registered." } };

  revalidatePath("/setup");
  return null;
}

export async function removeBundyIp(id: number): Promise<void> {
  await requireRole("ADMIN", "HR");
  await db.delete(bundyIp).where(eq(bundyIp.id, id));
  revalidatePath("/setup");
}
