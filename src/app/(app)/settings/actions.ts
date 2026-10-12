"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { appSetting, employee, users, userRole, type UserRole } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
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
  const user = await requireRole("OWNER");

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
  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "settings.save",
    entityType: "settings",
    entityId: "company",
    detail: { keys: ["companyName", ...CONTACT_KEYS] },
  });
  revalidatePath("/", "layout");
  return { message: "Saved." };
}

/** Saves one settings card — bound as `saveSettings.bind(null, "attendance")`. */
export async function saveSettings(
  card: SettingsCard,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = card === "security" ? await requireRole("OWNER") : await requireRole("ADMIN");
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
  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "settings.save",
    entityType: "settings",
    entityId: card,
    detail: { keys: Object.keys(values) },
  });
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
    .set({
      passwordHash: await hashPassword(next),
      tokenVersion: sql`token_version + 1`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));
  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "user.password_change",
    entityType: "user",
    entityId: user.id,
  });
  return { message: "Password updated." };
}

function notice(path: string, message: string): never {
  redirect(`${path}?msg=${encodeURIComponent(message)}`);
}

function refuse(message: string): never {
  redirect(`/settings/users?err=${encodeURIComponent(message)}`);
}

async function otherActiveOwnerExists(excludeId: string) {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(eq(users.role, "OWNER"), eq(users.isActive, true), ne(users.id, excludeId)),
    )
    .limit(1);
  return rows.length > 0;
}

export async function createUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireRole("OWNER");

  const email = field(formData, "email").trim().toLowerCase();
  const name = field(formData, "name").trim();
  const role = field(formData, "role");
  const password = field(formData, "password");
  const employeeId = Number(field(formData, "employeeId")) || null;

  const errors: Record<string, string> = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";
  if (!name) errors.name = "Name is required.";
  if (!(userRole.enumValues as readonly string[]).includes(role)) errors.role = "Unknown role.";
  const { passwordMinLength } = await getSecuritySettings();
  if (password.length < passwordMinLength) {
    errors.password = `Use at least ${passwordMinLength} characters.`;
  }
  if (employeeId) {
    const [emp] = await db
      .select({ id: employee.id })
      .from(employee)
      .where(eq(employee.id, employeeId))
      .limit(1);
    if (!emp) errors.employeeId = "Employee not found.";
    else {
      const [taken] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.employeeId, employeeId))
        .limit(1);
      if (taken) errors.employeeId = "That employee is already linked to another account.";
    }
  }
  if (Object.keys(errors).length > 0) return { errors };

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing) return { errors: { email: "An account with that email already exists." } };

  const [created] = await db
    .insert(users)
    .values({
      email,
      name,
      role: role as UserRole,
      passwordHash: await hashPassword(password),
      employeeId,
    })
    .returning({ id: users.id });
  await audit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "user.create",
    entityType: "user",
    entityId: created.id,
    detail: { email, role, employeeId },
  });
  revalidatePath("/settings/users");
  return { message: `Account created for ${name}.` };
}

export async function setEmployee(userId: string, formData: FormData): Promise<void> {
  const actor = await requireRole("OWNER");
  const employeeId = Number(field(formData, "employeeId")) || null;

  if (employeeId) {
    const [emp] = await db
      .select({ id: employee.id })
      .from(employee)
      .where(eq(employee.id, employeeId))
      .limit(1);
    if (!emp) refuse("Employee not found.");
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.employeeId, employeeId), ne(users.id, userId)))
      .limit(1);
    if (taken) refuse("That employee is already linked to another account.");
  }

  await db.update(users).set({ employeeId, updatedAt: new Date() }).where(eq(users.id, userId));
  await audit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: employeeId ? "user.link_employee" : "user.unlink_employee",
    entityType: "user",
    entityId: userId,
    detail: { employeeId },
  });
  notice("/settings/users", employeeId ? "Employee linked." : "Employee unlinked.");
}

export async function setRole(userId: string, formData: FormData): Promise<void> {
  const actor = await requireRole("OWNER");
  const role = field(formData, "role");
  if (!(userRole.enumValues as readonly string[]).includes(role)) refuse("Unknown role.");
  if (userId === actor.id) refuse("You cannot change your own role.");
  if (role !== "OWNER" && !(await otherActiveOwnerExists(userId))) {
    refuse("At least one active owner must remain.");
  }

  await db.update(users).set({ role: role as UserRole, updatedAt: new Date() }).where(eq(users.id, userId));
  await audit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "user.role_change",
    entityType: "user",
    entityId: userId,
    detail: { role },
  });
  notice("/settings/users", "Role updated.");
}

export async function toggleActive(userId: string): Promise<void> {
  const actor = await requireRole("OWNER");
  if (userId === actor.id) refuse("You cannot deactivate your own account.");

  const [target] = await db
    .select({ role: users.role, isActive: users.isActive })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!target) refuse("Account not found.");
  if (target.isActive && target.role === "OWNER" && !(await otherActiveOwnerExists(userId))) {
    refuse("At least one active owner must remain.");
  }

  const isActive = !target.isActive;
  await db
    .update(users)
    .set({
      isActive,
      // Deactivating also kills every live session for that account.
      ...(target.isActive ? { tokenVersion: sql`token_version + 1` } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
  await audit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: isActive ? "user.activate" : "user.deactivate",
    entityType: "user",
    entityId: userId,
  });
  notice(
    "/settings/users",
    isActive ? "Account activated." : "Account deactivated.",
  );
}

export async function resetPassword(userId: string, formData: FormData): Promise<void> {
  const actor = await requireRole("OWNER");
  if (userId === actor.id) refuse("Use the Security page to change your own password.");

  const password = field(formData, "password");
  const { passwordMinLength } = await getSecuritySettings();
  if (password.length < passwordMinLength) {
    refuse(`Password must be at least ${passwordMinLength} characters.`);
  }

  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(password),
      tokenVersion: sql`token_version + 1`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
  await audit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "user.password_reset",
    entityType: "user",
    entityId: userId,
  });
  notice("/settings/users", "Password reset — their existing sessions were signed out.");
}

export async function revokeSessions(userId: string): Promise<void> {
  const actor = await requireRole("OWNER");
  if (userId === actor.id) refuse("You cannot revoke your own sessions.");

  await db
    .update(users)
    .set({ tokenVersion: sql`token_version + 1`, updatedAt: new Date() })
    .where(eq(users.id, userId));
  await audit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "user.sessions_revoke",
    entityType: "user",
    entityId: userId,
  });
  notice("/settings/users", "Sessions revoked.");
}

export async function clearPhoto(employeeId: number): Promise<void> {
  const actor = await requireRole("OWNER");

  await db.update(employee).set({ photo: null, updatedAt: new Date() }).where(eq(employee.id, employeeId));
  await audit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "employee.photo_clear",
    entityType: "employee",
    entityId: employeeId,
  });
  revalidatePath("/settings/photos");
  notice("/settings/photos", "Photo cleared.");
}
