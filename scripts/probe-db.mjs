import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const r = await sql`SELECT current_database() AS db, version() AS v, now() AS ts`;
console.log("connect ok:", JSON.stringify(r[0]));

const r4 = await sql`SELECT x FROM (VALUES (1),(2)) t(x) ORDER BY x FOR UPDATE SKIP LOCKED LIMIT 1`;
console.log("skip-locked ok:", JSON.stringify(r4[0]));

const r5 = await sql`SELECT ${1} AS param`;
console.log("param ok:", JSON.stringify(r5[0]));

console.log("ALL OK");
