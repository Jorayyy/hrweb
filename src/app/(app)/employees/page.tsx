import Link from "next/link";
import { and, eq, ilike, or } from "drizzle-orm";
import { Plus, Search } from "lucide-react";
import { db } from "@/db";
import { campaign, employee, employmentStatus, jobPosition } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { formatPhp } from "@/lib/money";
import { PageBody, PageHeader } from "@/components/page-header";
import { StatusBadge, humanize } from "@/components/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { selectCx } from "@/components/ui/field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const LIMIT = 100;

function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; status?: string; saved?: string }>;
}) {
  await requireRole("ADMIN", "HR");

  const params = (await searchParams) ?? {};
  const q = (params.q ?? "").trim();
  const status = (params.status ?? "").trim();
  const saved = (params.saved ?? "").trim();
  const statuses = employmentStatus.enumValues;
  const activeStatus = statuses.includes(status as (typeof statuses)[number]) ? status : "";

  const conditions = [];
  if (q) {
    conditions.push(
      or(
        ilike(employee.firstName, `%${q}%`),
        ilike(employee.lastName, `%${q}%`),
        ilike(employee.employeeNo, `%${q}%`),
      ),
    );
  }
  if (activeStatus) conditions.push(eq(employee.status, activeStatus as (typeof statuses)[number]));

  const rows = await db
    .select({
      id: employee.id,
      employeeNo: employee.employeeNo,
      firstName: employee.firstName,
      lastName: employee.lastName,
      status: employee.status,
      baseSalaryMonthly: employee.baseSalaryMonthly,
      campaignName: campaign.name,
      positionTitle: jobPosition.title,
    })
    .from(employee)
    .leftJoin(campaign, eq(employee.campaignId, campaign.id))
    .leftJoin(jobPosition, eq(employee.positionId, jobPosition.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(employee.lastName, employee.firstName)
    .limit(LIMIT + 1);

  const truncated = rows.length > LIMIT;
  const visible = truncated ? rows.slice(0, LIMIT) : rows;

  return (
    <>
      <PageHeader
        back
        title="Employees"
        description={`${visible.length} shown${truncated ? ` of 100+` : ""}`}
      >
        <Button asChild variant="outline" size="sm">
          <Link href="/setup">Setup</Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/employees/new">
            <Plus />
            Add employee
          </Link>
        </Button>
      </PageHeader>

      <PageBody>
        {saved ? (
          <div className="mb-4 rounded-lg border border-emerald-600/30 bg-emerald-600/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
            Employee created.
          </div>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle>Roster</CardTitle>
            <form method="get" className="mt-3 flex flex-wrap items-center gap-2">
              <div className="relative min-w-56 flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  name="q"
                  defaultValue={q}
                  placeholder="Search name or employee no."
                  className="pl-8"
                />
              </div>
              <select name="status" defaultValue={activeStatus} className={selectCx}>
                <option value="">All statuses</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {humanize(s)}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="outline" size="sm">
                Filter
              </Button>
            </form>
          </CardHeader>

          <CardContent>
            {visible.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {q || activeStatus ? "Nothing matches those filters." : "No employees yet."}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Monthly</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link
                          href={`/employees/${r.id}`}
                          className="flex items-center gap-3 hover:underline"
                        >
                          <Avatar className="size-8">
                            <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
                              {initials(r.firstName, r.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <span>
                            <span className="block font-medium">
                              {r.lastName}, {r.firstName}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {r.employeeNo}
                            </span>
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.campaignName ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.positionTitle ?? "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPhp(r.baseSalaryMonthly)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {truncated ? (
              <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                Limited to {LIMIT} rows — refine the search to narrow it down.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
