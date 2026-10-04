"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { employee, shiftTemplate } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { field, type FormState } from "@/lib/form";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const WINDOWS: [string, string, string][] = [
  ["break1Start", "break1End", "1st break"],
  ["lunchStart", "lunchEnd", "Lunch"],
  ["break2Start", "break2End", "2nd break"],
];
const TIME_FIELDS = ["startsAt", "endsAt", ...WINDOWS.flatMap(([s, e]) => [s, e])];

export async function addShift(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("ADMIN", "HR");

  const code = field(formData, "code").toUpperCase();
  const name = field(formData, "name");
  const errors: Record<string, string> = {};
  if (!code) errors.code = "Code is required.";
  if (!name) errors.name = "Name is required.";
  for (const key of TIME_FIELDS) {
    if (!HHMM.test(field(formData, key))) errors[key] = "Use HH:MM (24-hour).";
  }
  if (Object.keys(errors).length === 0) {
    if (field(formData, "startsAt") === field(formData, "endsAt"))
      errors.endsAt = "Start and end cannot be the same.";
    for (const [s, e, label] of WINDOWS) {
      if (!(field(formData, s) < field(formData, e))) errors[e] = `${label} must end after it starts.`;
    }
  }
  if (Object.keys(errors).length > 0) return { errors };

  const values = {
    code,
    name,
    startsAt: field(formData, "startsAt"),
    endsAt: field(formData, "endsAt"),
    break1Start: field(formData, "break1Start"),
    break1End: field(formData, "break1End"),
    lunchStart: field(formData, "lunchStart"),
    lunchEnd: field(formData, "lunchEnd"),
    break2Start: field(formData, "break2Start"),
    break2End: field(formData, "break2End"),
  };
  const [row] = await db
    .insert(shiftTemplate)
    .values(values)
    .onConflictDoNothing()
    .returning({ id: shiftTemplate.id });
  if (!row) return { errors: { code: "That code already exists." } };

  revalidatePath("/schedule");
  return null;
}

export async function removeShift(id: number): Promise<void> {
  await requireRole("ADMIN", "HR");
  await db.update(employee).set({ shiftTemplateId: null }).where(eq(employee.shiftTemplateId, id));
  await db.delete(shiftTemplate).where(eq(shiftTemplate.id, id));
  revalidatePath("/schedule");
}

export async function assignShift(formData: FormData): Promise<void> {
  await requireRole("ADMIN", "HR");
  const employeeId = Number(field(formData, "employeeId"));
  const raw = field(formData, "shiftTemplateId");
  if (!Number.isInteger(employeeId)) return;
  await db
    .update(employee)
    .set({ shiftTemplateId: raw ? Number(raw) : null })
    .where(eq(employee.id, employeeId));
  revalidatePath("/schedule");
}
