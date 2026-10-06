"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSetting } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { field, type FormState } from "@/lib/form";

const MAX_LOGO_BYTES = 200 * 1024;
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

async function upsert(key: string, value: string) {
  await db
    .insert(appSetting)
    .values({ key, value })
    .onConflictDoUpdate({ target: appSetting.key, set: { value } });
}

export async function saveCompany(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("ADMIN");

  const name = field(formData, "companyName");
  if (!name) return { errors: { companyName: "Company name is required." } };
  if (name.length > 80) return { errors: { companyName: "Keep it under 80 characters." } };

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
  revalidatePath("/", "layout");
  return { message: "Saved." };
}
