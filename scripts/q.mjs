// Usage: node --env-file-if-exists=.env.local scripts/q.mjs "SELECT ..."
import { neon } from "@neondatabase/serverless";

const query = process.argv.slice(2).join(" ");
if (!query) {
  console.error("no query given");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
try {
  const rows = await sql.query(query);
  console.table(rows.rows ?? rows);
} catch (err) {
  console.error("SQL ERROR:", err.message);
  process.exit(1);
}
