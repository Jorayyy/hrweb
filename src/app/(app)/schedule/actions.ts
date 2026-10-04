"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { employee, shiftTemplate } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { field, type FormState } from "@/lib/form";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const BREAK_WINDOWS: [string, string, string][] = [
  ["break1Start", "break1End", "1st break"],
  ["break2Start", "break2End", "2nd break"],
];
const REQUIRED_TIME_FIELDS = ["startsAt", "endsAt", "lunchStart", "lunchEnd"];

export async function addShift(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("ADMIN", "HR");

  const code = field(formData, "code").toUpperCase();
  const name = field(formData, "name");
  const errors: Record<string, string> = {};
  if (!code) errors.code = "Code is required.";
  if (!name) errors.name = "Name is required.";
  for (const key of REQUIRED_TIME_FIELDS) {
    if (!HHMM.test(field(formData, key))) errors[key] = "Use HH:MM (24-hour).";
  }
  for (const [s, e, label] of BREAK_WINDOWS) {
    const sv = field(formData, s);
    const ev = field(formData, e);
    if (sv && !HHMM.test(sv)) errors[s] = "Use HH:MM (24-hour).";
    if (ev && !HHMM.test(ev)) errors[e] = "Use HH:MM (24-hour).";
    if (sv && !ev) errors[e] = `${label} end is required when start is set.`;
    if (!sv && ev) errors[s] = `${label} start is required when end is set.`;
    if (HHMM.test(sv) && HHMM.test(ev) && !(sv < ev))
      errors[e] = `${label} must end after it starts.`;
  }
  if (Object.keys(errors).length === 0) {
    if (field(formData, "startsAt") === field(formData, "endsAt"))
      errors.endsAt = "Start and end cannot be the same.";
  }
  if (Object.keys(errors).length > 0) return { errors };

  const optional = (key: string) => field(formData, key) || null;
  const values = {
    code,
    name,
    startsAt: field(formData, "startsAt"),
    endsAt: field(formData, "endsAt"),
    break1Start: optional("break1Start"),
    break1End: optional("break1End"),
    lunchStart: field(formData, "lunchStart"),
    lunchEnd: field(formData, "lunchEnd"),
    break2Start: optional("break2Start"),
    break2End: optional("break2End"),
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
