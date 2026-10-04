"use server";

import { and, eq, ne, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { employee } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { parseEmployee, type EmployeeInput } from "@/lib/employee";
import type { FormState } from "@/lib/form";
import { hashPassword } from "@/lib/password";

async function findClash(value: EmployeeInput, excludeId: number | null) {
  const condition = or(
    eq(employee.employeeNo, value.employeeNo),
    value.email ? eq(employee.email, value.email) : undefined,
    and(eq(employee.externalCode, value.externalCode), eq(employee.campaignId, value.campaignId)),
  );
  const [row] = await db
    .select({
      id: employee.id,
      employeeNo: employee.employeeNo,
      externalCode: employee.externalCode,
      email: employee.email,
      campaignId: employee.campaignId,
    })
    .from(employee)
    .where(and(condition, excludeId ? ne(employee.id, excludeId) : undefined))
    .limit(1);

  if (!row) return null;

  const errors: Record<string, string> = {};
  if (row.employeeNo === value.employeeNo) errors.employeeNo = "That employee no. is already in use.";
  if (value.email && row.email === value.email) errors.email = "That email is already in use.";
  if (row.externalCode === value.externalCode && row.campaignId === value.campaignId) {
    errors.externalCode = "That biometric code is already used in this campaign.";
  }
  return Object.keys(errors).length > 0 ? errors : null;
}

export async function createEmployee(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("ADMIN", "HR");

  const parsed = parseEmployee(formData);
  if (!parsed.ok) return { errors: parsed.errors };

  const clash = await findClash(parsed.value, null);
  if (clash) return { errors: clash };

  const { bundyPin, ...values } = parsed.value;
  await db.insert(employee).values({
    ...values,
    bundyPin: bundyPin ? await hashPassword(bundyPin) : null,
  });
  revalidatePath("/employees");
  redirect("/employees?saved=1");
}

export async function updateEmployee(
  id: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("ADMIN", "HR");

  const parsed = parseEmployee(formData);
  if (!parsed.ok) return { errors: parsed.errors };

  const errors: Record<string, string> = {};
  if (parsed.value.reportsToId === id) errors.reportsToId = "An employee cannot report to themselves.";
  if (Object.keys(errors).length > 0) return { errors };

  const clash = await findClash(parsed.value, id);
  if (clash) return { errors: clash };

  const { bundyPin, ...values } = parsed.value;
  await db
    .update(employee)
    .set({
      ...values,
      ...(bundyPin ? { bundyPin: await hashPassword(bundyPin) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(employee.id, id));

  revalidatePath("/employees");
  redirect(`/employees/${id}?saved=1`);
}
