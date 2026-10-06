import { cache } from "react";
import { db } from "@/db";
import { appSetting } from "@/db/schema";

export const DEFAULT_COMPANY = "BPO-HRWeb";

/** Company name + logo (data URL), cached per request. */
export const getCompany = cache(async (): Promise<{ name: string; logo: string | null }> => {
  try {
    const rows = await db.select().from(appSetting);
    const map = new Map(rows.map((r) => [r.key, r.value]));
    return {
      name: map.get("companyName") || DEFAULT_COMPANY,
      logo: map.get("companyLogo") || null,
    };
  } catch {
    return { name: DEFAULT_COMPANY, logo: null };
  }
});
