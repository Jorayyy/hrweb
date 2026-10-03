import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
await sql`DROP SCHEMA IF EXISTS public CASCADE`;
await sql`CREATE SCHEMA public`;
await sql`DROP SCHEMA IF EXISTS drizzle CASCADE`;
console.log("reset ok");
