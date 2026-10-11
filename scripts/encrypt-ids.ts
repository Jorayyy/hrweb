import "../env";
import { sql } from "drizzle-orm";
import { db } from "../src/db";
import { employee } from "../src/db/schema";
import { isEncrypted } from "../src/lib/crypto";

const FIELDS = [
  ["tin_no", "tinNo"],
  ["sss_no", "sssNo"],
  ["philhealth_no", "philhealthNo"],
  ["pagibig_no", "pagibigNo"],
] as const;

/** One-time: encrypt statutory IDs still stored as plaintext. Idempotent.
 *  Reads raw (bypassing the decrypting column type); writes go through
 *  drizzle so the encryptedText column encrypts each value once. */
async function main() {
  if (!process.env.DATA_ENCRYPTION_KEY) {
    console.error("DATA_ENCRYPTION_KEY is required — set it in .env.local first.");
    process.exit(1);
  }

  const rows = await db.execute<Record<string, string | null>>(
    sql`select id, tin_no, sss_no, philhealth_no, pagibig_no from employee`,
  );

  let updated = 0;
  for (const row of rows.rows as Record<string, string | null>[]) {
    const patch: Record<string, string> = {};
    for (const [raw, js] of FIELDS) {
      const value = row[raw];
      if (value && !isEncrypted(value)) patch[js] = value;
    }
    if (Object.keys(patch).length > 0) {
      await db.update(employee).set(patch).where(sql`${employee.id} = ${row.id}`);
      updated += 1;
    }
  }
  console.log(`scanned ${rows.rows.length} employees, encrypted IDs on ${updated}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
