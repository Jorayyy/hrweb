import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

console.log("Wiping demo data (keeping users, statutory tables, company settings)…");

// Order matters: no CASCADE on any FK. Children first, then parents.
// Table names are trusted constants above — interpolated via sql.unsafe.
const tables = [
  "payroll_line",
  "payroll_adjustment",
  "payslip_revision",
  "payroll_job",
  "payroll_run_item",
  "payroll_run",
  "payroll_period",
  "attendance_day",
  "leave_request",
  "employee_compensation_history",
  "employee_allowance",
  "employee",
  "announcement",
  "audit_log",
  "login_attempt",
  "bundy_ip",
  "shift_template",
  "job_position",
  "department",
  "campaign",
  "cost_center",
];

// Clear the self-referencing FK before deleting employees
await sql`UPDATE employee SET reports_to_id = NULL WHERE reports_to_id IS NOT NULL`;

let total = 0;
for (const table of tables) {
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM ${sql.unsafe(table)}`;
  await sql`DELETE FROM ${sql.unsafe(table)}`;
  total += n;
  console.log(`  ${table}: ${n} row(s) deleted`);
}

// Null dangling employee links on users (users themselves are kept)
await sql`UPDATE users SET employee_id = NULL WHERE employee_id IS NOT NULL`;

const [{ count }] = await sql`SELECT count(*)::int AS count FROM users`;
console.log(`\nDone. ${total} row(s) wiped across ${tables.length} tables.`);
console.log(`${count} user account(s) preserved.`);
console.log("Statutory schedules, holiday calendar, and company settings untouched.");
