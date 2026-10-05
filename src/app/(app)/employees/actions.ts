"use server";

import { and, eq, ne, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { employee, employeeCompensationHistory } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { parseEmployee, type EmployeeInput } from "@/lib/employee";
import type { FormState } from "@/lib/form";
import { hashPassword } from "@/lib/password";
import { manilaDateKey } from "@/lib/time";

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
  const user = await requireRole("ADMIN", "HR");

  const parsed = parseEmployee(formData);
  if (!parsed.ok) return { errors: parsed.errors };

  const clash = await findClash(parsed.value, null);
  if (clash) return { errors: clash };

  const { bundyPin, ...values } = parsed.value;
  const [created] = await db
    .insert(employee)
    .values({
      ...values,
      bundyPin: bundyPin ? await hashPassword(bundyPin) : null,
    })
    .returning({ id: employee.id });
  await db.insert(employeeCompensationHistory).values({
    employeeId: created.id,
    baseSalaryMonthly: values.baseSalaryMonthly,
    payFrequency: values.payFrequency,
    effectiveFrom: values.dateHired,
    reason: "HIRE",
    changedBy: user.id,
  });
  revalidatePath("/employees");
  redirect("/employees?saved=1");
}

export async function updateEmployee(
  id: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireRole("ADMIN", "HR");

  const parsed = parseEmployee(formData);
  if (!parsed.ok) return { errors: parsed.errors };

  const errors: Record<string, string> = {};
  if (parsed.value.reportsToId === id) errors.reportsToId = "An employee cannot report to themselves.";
  if (Object.keys(errors).length > 0) return { errors };

  const clash = await findClash(parsed.value, id);
  if (clash) return { errors: clash };

  const [prev] = await db
    .select({
      baseSalaryMonthly: employee.baseSalaryMonthly,
      payFrequency: employee.payFrequency,
    })
    .from(employee)
    .where(eq(employee.id, id))
    .limit(1);

  const { bundyPin, ...values } = parsed.value;
  await db
    .update(employee)
    .set({
      ...values,
      ...(bundyPin ? { bundyPin: await hashPassword(bundyPin) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(employee.id, id));

  const salaryChanged = prev && prev.baseSalaryMonthly !== values.baseSalaryMonthly;
  const freqChanged = prev && prev.payFrequency !== values.payFrequency;
  if (salaryChanged || freqChanged) {
    await db
      .insert(employeeCompensationHistory)
      .values({
        employeeId: id,
        baseSalaryMonthly: values.baseSalaryMonthly,
        payFrequency: values.payFrequency,
        effectiveFrom: manilaDateKey(Date.now()),
        reason: salaryChanged && freqChanged ? "COMP_CHANGE" : salaryChanged ? "SALARY_CHANGE" : "PAY_FREQ_CHANGE",
        changedBy: user.id,
      })
      .onConflictDoUpdate({
        target: [employeeCompensationHistory.employeeId, employeeCompensationHistory.effectiveFrom],
        set: {
          baseSalaryMonthly: values.baseSalaryMonthly,
          payFrequency: values.payFrequency,
          reason: salaryChanged && freqChanged ? "COMP_CHANGE" : salaryChanged ? "SALARY_CHANGE" : "PAY_FREQ_CHANGE",
          changedBy: user.id,
        },
      });
  }

  revalidatePath("/employees");
  redirect(`/employees/${id}?saved=1`);
}
