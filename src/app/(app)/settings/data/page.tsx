import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  announcement,
  attendanceDay,
  employee,
  payrollPeriod,
  payrollRun,
  payrollRunItem,
  users,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { PageBody, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DataSettingsPage() {
  await requireRole("ADMIN");

  const [[employees], [active], [accounts], [days], [periods], [runs], [items], [posts]] =
    await Promise.all([
      db.select({ n: count() }).from(employee),
      db.select({ n: count() }).from(employee).where(eq(employee.status, "ACTIVE")),
      db.select({ n: count() }).from(users),
      db.select({ n: count() }).from(attendanceDay),
      db.select({ n: count() }).from(payrollPeriod),
      db.select({ n: count() }).from(payrollRun),
      db.select({ n: count() }).from(payrollRunItem),
      db.select({ n: count() }).from(announcement),
    ]);

  const rows: [string, number][] = [
    ["Employees", employees.n],
    ["Active employees", active.n],
    ["User accounts", accounts.n],
    ["Attendance day rows", days.n],
    ["Payroll periods", periods.n],
    ["Payroll runs", runs.n],
    ["Payslip lines", items.n],
    ["Announcements", posts.n],
  ];

  return (
    <>
      <PageHeader back title="Data" description="What is currently stored" />
      <PageBody>
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Records</CardTitle>
            <CardDescription>
              Read-only totals. Nothing is deleted here — maintenance runs go through the
              database directly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              {rows.map(([label, n]) => (
                <div key={label} className="col-span-2 flex justify-between gap-4 sm:col-span-1">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="tabular-nums">{n.toLocaleString("en-PH")}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
