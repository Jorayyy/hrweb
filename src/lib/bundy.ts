import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bundyIp } from "@/db/schema";

export function clientIp(headers: Headers): string {
  const raw = headers.get("x-forwarded-for") ?? headers.get("x-real-ip") ?? "";
  return raw.split(",")[0].trim();
}

export async function isBundyIpAllowed(ip: string): Promise<boolean> {
  if (!ip) return false;
  const [row] = await db
    .select({ id: bundyIp.id })
    .from(bundyIp)
    .where(eq(bundyIp.ip, ip))
    .limit(1);
  return Boolean(row);
}
