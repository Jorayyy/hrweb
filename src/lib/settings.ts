import { cache } from "react";
import { db } from "@/db";
import { appSetting } from "@/db/schema";
import { setLocaleSettings } from "@/lib/money";

export const DEFAULT_COMPANY = "BPO-HRWeb";

export const DATE_STYLES = ["full", "long", "medium", "short"] as const;
export type DateStyle = (typeof DATE_STYLES)[number];

export const PAY_FREQUENCIES = ["SEMI_MONTHLY", "MONTHLY", "WEEKLY", "DAILY"] as const;
export type PayFrequency = (typeof PAY_FREQUENCIES)[number];

/** Raw settings map — read straight from the DB (used by scripts outside React). */
export async function readSettings(): Promise<Map<string, string>> {
  try {
    const rows = await db.select().from(appSetting);
    return new Map(rows.map((r) => [r.key, r.value]));
  } catch {
    return new Map();
  }
}

const settings = cache(readSettings);

function text(map: Map<string, string>, key: string, fallback = ""): string {
  return (map.get(key) ?? "").trim() || fallback;
}

function int(
  map: Map<string, string>,
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = map.get(key);
  if (raw === undefined || !/^-?\d+$/.test(raw.trim())) return fallback;
  return Math.min(max, Math.max(min, Number(raw)));
}

function oneOf<T extends string>(
  map: Map<string, string>,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const raw = text(map, key);
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

export type CompanySettings = {
  name: string;
  logo: string | null;
  address: string;
  tin: string;
  doleRegNo: string;
  phone: string;
  email: string;
};

/** Company identity shown in the sidebar, login page, payslips. */
export const getCompany = cache(async (): Promise<CompanySettings> => {
  const map = await settings();
  return {
    name: text(map, "companyName", DEFAULT_COMPANY),
    logo: map.get("companyLogo") || null,
    address: text(map, "companyAddress"),
    tin: text(map, "companyTin"),
    doleRegNo: text(map, "companyDoleRegNo"),
    phone: text(map, "companyPhone"),
    email: text(map, "companyEmail"),
  };
});

export type LocaleSettings = {
  currency: string;
  dateStyle: DateStyle;
  grouping: boolean;
};

export const getLocaleSettings = cache(async (): Promise<LocaleSettings> => {
  const map = await settings();
  const currency = text(map, "localeCurrency", "PHP").toUpperCase();
  return {
    currency: /^[A-Z]{3}$/.test(currency) ? currency : "PHP",
    dateStyle: oneOf(map, "localeDateStyle", DATE_STYLES, "medium"),
    grouping: map.get("localeGrouping") !== "false",
  };
});

/** Applies saved locale settings to the shared formatters. Called once per render. */
export const applyLocaleSettings = cache(async (): Promise<void> => {
  setLocaleSettings(await getLocaleSettings());
});

export type AttendanceRules = {
  graceSeconds: number;
  otRoundSeconds: number;
};

/** Grace minutes before a punch counts as late; OT rounding increment (0 = exact seconds). */
export const getAttendanceRules = cache(async (): Promise<AttendanceRules> => {
  const map = await settings();
  return {
    graceSeconds: int(map, "lateGraceMinutes", 0, 0, 60) * 60,
    otRoundSeconds: int(map, "otRoundMinutes", 0, 0, 120) * 60,
  };
});

export type PayrollSettings = {
  defaultPayFrequency: PayFrequency;
  payslipFooterNote: string;
};

export const getPayrollSettings = cache(async (): Promise<PayrollSettings> => {
  const map = await settings();
  return {
    defaultPayFrequency: oneOf(map, "defaultPayFrequency", PAY_FREQUENCIES, "SEMI_MONTHLY"),
    payslipFooterNote: text(map, "payslipFooterNote"),
  };
});

export type SecuritySettings = {
  passwordMinLength: number;
  sessionTimeoutDays: number;
  loginLockoutAttempts: number;
  loginLockoutMinutes: number;
  kioskLockoutAttempts: number;
  kioskLockoutMinutes: number;
};

export const getSecuritySettings = cache(async (): Promise<SecuritySettings> => {
  const map = await settings();
  return {
    passwordMinLength: int(map, "passwordMinLength", 8, 6, 128),
    sessionTimeoutDays: int(map, "sessionTimeoutDays", 30, 1, 365),
    loginLockoutAttempts: int(map, "loginLockoutAttempts", 5, 3, 100),
    loginLockoutMinutes: int(map, "loginLockoutMinutes", 15, 1, 1440),
    kioskLockoutAttempts: int(map, "kioskLockoutAttempts", 5, 3, 100),
    kioskLockoutMinutes: int(map, "kioskLockoutMinutes", 15, 1, 1440),
  };
});
