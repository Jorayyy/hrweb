import Link from "next/link";
import { count, eq, isNotNull } from "drizzle-orm";
import { ArrowRight, Check, CircleDashed } from "lucide-react";
import { db } from "@/db";
import {
  attendanceDay,
  campaign,
  costCenter,
  department,
  employee,
  jobPosition,
  payrollRun,
  shiftTemplate,
  appSetting,
  type UserRole,
} from "@/db/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Item = {
  label: string;
  href: string;
  done: boolean;
  ownerOnly?: boolean;
};

export async function SetupChecklist({ role }: { role: UserRole }) {
  const one = async <T,>(query: Promise<T[]>): Promise<T | undefined> => (await query)[0];

  const [
    companyRow,
    costCenters,
    campaigns,
    departments,
    positions,
    shifts,
    employees,
    approvedDays,
    postedRuns,
  ] = await Promise.all([
    one(db.select({ value: appSetting.value }).from(appSetting).where(eq(appSetting.key, "companyName"))),
    one(db.select({ n: count() }).from(costCenter)),
    one(db.select({ n: count() }).from(campaign)),
    one(db.select({ n: count() }).from(department)),
    one(db.select({ n: count() }).from(jobPosition)),
    one(db.select({ n: count() }).from(shiftTemplate)),
    one(db.select({ n: count() }).from(employee)),
    one(db.select({ n: count() }).from(attendanceDay).where(isNotNull(attendanceDay.reviewedAt))),
    one(db.select({ n: count() }).from(payrollRun).where(eq(payrollRun.status, "POSTED"))),
  ]);

  const items: Item[] = [
    { label: "Company profile", href: "/settings/company", done: !!companyRow, ownerOnly: true },
    { label: "Cost centers", href: "/setup/cost-centers", done: (costCenters?.n ?? 0) > 0 },
    { label: "Campaigns", href: "/setup/campaigns", done: (campaigns?.n ?? 0) > 0 },
    { label: "Departments", href: "/setup/departments", done: (departments?.n ?? 0) > 0 },
    { label: "Job positions", href: "/setup/job-positions", done: (positions?.n ?? 0) > 0 },
    { label: "Shift template", href: "/schedule", done: (shifts?.n ?? 0) > 0 },
    { label: "First employee", href: "/employees/new", done: (employees?.n ?? 0) > 0 },
    { label: "First DTR approval", href: "/dtr-review", done: (approvedDays?.n ?? 0) > 0 },
    { label: "First payroll posted", href: "/payroll", done: (postedRuns?.n ?? 0) > 0 },
  ].filter((item) => !item.ownerOnly || role === "OWNER");

  const doneCount = items.filter((item) => item.done).length;
  if (doneCount === items.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Getting started</CardTitle>
        <CardDescription>
          {doneCount} of {items.length} done — finish these and this card disappears.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-1">
          {items.map((item) => (
            <li key={item.label}>
              {item.done ? (
                <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground">
                  <Check className="size-4 shrink-0 text-emerald-500" />
                  <span className="line-through decoration-muted-foreground/40">{item.label}</span>
                </div>
              ) : (
                <Link
                  href={item.href}
                  className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent"
                >
                  <CircleDashed className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1">{item.label}</span>
                  <ArrowRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
