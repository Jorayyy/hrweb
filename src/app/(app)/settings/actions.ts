"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSetting, users } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { field, type FormState } from "@/lib/form";
import { hashPassword, verifyPassword } from "@/lib/password";
import { DATE_STYLES, PAY_FREQUENCIES, getSecuritySettings } from "@/lib/settings";

const MAX_LOGO_BYTES = 200 * 1024;
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const CONTACT_KEYS = [
  "companyAddress",
  "companyTin",
  "companyDoleRegNo",
  "companyPhone",
  "companyEmail",
] as const;

export type SettingsCard = "locale" | "attendance" | "payroll" | "security";

async function upsert(key: string, value: string) {
  await db
    .insert(appSetting)
    .values({ key, value })
    .onConflictDoUpdate({ target: appSetting.key, set: { value } });
}

function intField(formData: FormData, name: string, min: number, max: number): number | null {
  const raw = field(formData, name);
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n >= min && n <= max ? n : null;
}

function intError(name: string, min: number, max: number): FormState {
  return { errors: { [name]: `Enter a whole number from ${min} to ${max}.` } };
}

export async function saveCompany(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("ADMIN");

  const name = field(formData, "companyName");
  if (!name) return { errors: { companyName: "Company name is required." } };
  if (name.length > 80) return { errors: { companyName: "Keep it under 80 characters." } };

  const contact: Record<string, string> = {};
  for (const key of CONTACT_KEYS) {
    const value = field(formData, key);
    if (value.length > 200) return { errors: { [key]: "Keep it under 200 characters." } };
    contact[key] = value;
  }
  if (contact.companyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.companyEmail)) {
    return { errors: { companyEmail: "Enter a valid email address." } };
  }

  const file = formData.get("logo");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_LOGO_BYTES) {
      return { errors: { logo: "Logo must be 200KB or smaller." } };
    }
    if (!LOGO_TYPES.includes(file.type)) {
      return { errors: { logo: "Use a PNG, JPG, WebP or SVG file." } };
    }
    const buf = Buffer.from(await file.arrayBuffer());
    await upsert("companyLogo", `data:${file.type};base64,${buf.toString("base64")}`);
  }
  if (formData.get("removeLogo") === "on") {
    await db.delete(appSetting).where(eq(appSetting.key, "companyLogo"));
  }

  await upsert("companyName", name);
  for (const [key, value] of Object.entries(contact)) await upsert(key, value);
  revalidatePath("/", "layout");
  return { message: "Saved." };
}

/** Saves one settings card — bound as `saveSettings.bind(null, "attendance")`. */
export async function saveSettings(
  card: SettingsCard,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("ADMIN");
  const values: Record<string, string> = {};

  if (card === "locale") {
    const currency = field(formData, "currency").toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      return { errors: { currency: "Use a 3-letter currency code, e.g. PHP." } };
    }
    const dateStyle = field(formData, "dateStyle");
    if (!(DATE_STYLES as readonly string[]).includes(dateStyle)) {
      return { errors: { dateStyle: "Unknown date format." } };
    }
    values.localeCurrency = currency;
    values.localeDateStyle = dateStyle;
    values.localeGrouping = field(formData, "grouping") === "true" ? "true" : "false";
  } else if (card === "attendance") {
    const specs: Record<string, readonly [number, number]> = {
      lateGraceMinutes: [0, 60],
      otRoundMinutes: [0, 120],
    };
    for (const [name, [min, max]] of Object.entries(specs)) {
      const value = intField(formData, name, min, max);
      if (value === null) return intError(name, min, max);
      values[name] = String(value);
    }
  } else if (card === "payroll") {
    const frequency = field(formData, "defaultPayFrequency");
    if (!(PAY_FREQUENCIES as readonly string[]).includes(frequency)) {
      return { errors: { defaultPayFrequency: "Unknown frequency." } };
    }
    const note = field(formData, "payslipFooterNote");
    if (note.length > 300) {
      return { errors: { payslipFooterNote: "Keep it under 300 characters." } };
    }
    values.defaultPayFrequency = frequency;
    values.payslipFooterNote = note;
  } else if (card === "security") {
    const specs: Record<string, readonly [number, number]> = {
      passwordMinLength: [6, 128],
      sessionTimeoutDays: [1, 365],
      loginLockoutAttempts: [3, 100],
      loginLockoutMinutes: [1, 1440],
      kioskLockoutAttempts: [3, 100],
      kioskLockoutMinutes: [1, 1440],
    };
    for (const [name, [min, max]] of Object.entries(specs)) {
      const value = intField(formData, name, min, max);
      if (value === null) return intError(name, min, max);
      values[name] = String(value);
    }
  } else {
    return { error: "Unknown settings card." };
  }

  for (const [key, value] of Object.entries(values)) await upsert(key, value);
  revalidatePath("/", "layout");
  return { message: "Saved." };
}

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole();
  const current = field(formData, "currentPassword");
  const next = field(formData, "newPassword");
  const confirm = field(formData, "confirmPassword");

  if (!current) return { errors: { currentPassword: "Enter your current password." } };
  if (!next) return { errors: { newPassword: "Enter a new password." } };
  if (next !== confirm) return { errors: { confirmPassword: "Passwords do not match." } };

  const { passwordMinLength } = await getSecuritySettings();
  if (next.length < passwordMinLength) {
    return { errors: { newPassword: `Use at least ${passwordMinLength} characters.` } };
  }

  const [acct] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if (!acct || !(await verifyPassword(current, acct.passwordHash))) {
    return { errors: { currentPassword: "Current password is incorrect." } };
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(next), updatedAt: new Date() })
    .where(eq(users.id, user.id));
  return { message: "Password updated." };
}
