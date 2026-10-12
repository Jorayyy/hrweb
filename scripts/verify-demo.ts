import "../env";
import { sql } from "drizzle-orm";
import { db } from "../src/db";

async function q(label: string, query: ReturnType<typeof sql>) {
  const rows = await db.execute(query);
  console.log(`\n--- ${label} ---`);
  for (const r of rows.rows ?? rows) console.log(r);
}

async function main() {
  await q("employee count by campaign", sql`
    select c.code, count(*) as n
    from employee e join campaign c on c.id = e.campaign_id
    group by c.code order by c.code`);
  await q("distinct names (should be 40)", sql`
    select count(*) as total, count(distinct first_name || ' ' || last_name) as distinct_names
    from employee`);
  await q("payroll runs", sql`
    select p.period_code, p.date_from, p.date_to, r.status, r.headcount, r.net_total/100 as net_php
    from payroll_run r join payroll_period p on p.id = r.period_id
    order by p.date_from`);
  await q("attendance status breakdown", sql`
    select status, count(*) as n from attendance_day group by status order by n desc`);
  await q("leave requests", sql`
    select lt.code, lr.status, lr.date_from, lr.date_to, lr.days
    from leave_request lr join leave_type lt on lt.id = lr.leave_type_id
    order by lr.date_from`);
  await q("users preserved", sql`select email, role from users order by id`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
