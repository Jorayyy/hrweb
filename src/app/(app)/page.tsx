import Link from "next/link";
import { count, desc, eq, gte, sum } from "drizzle-orm";
import { db } from "@/db";
import { campaign, employee, jobPosition, users } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { formatDate, formatPhp } from "@/lib/money";
import { PageBody, PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

export default async function Dashboard() {
  const user = await requireRole();

  if (user.role === "EMPLOYEE") {
    const [acct] = await db
      .select({ employeeId: users.employeeId })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    const [me] = acct?.employeeId
      ? await db
          .select({
            id: employee.id,
            employeeNo: employee.employeeNo,
            firstName: employee.firstName,
            lastName: employee.lastName,
            dateHired: employee.dateHired,
            status: employee.status,
            positionTitle: jobPosition.title,
          })
          .from(employee)
          .leftJoin(jobPosition, eq(employee.positionId, jobPosition.id))
          .where(eq(employee.id, acct.employeeId))
          .limit(1)
      : [];

    return (
      <>
        <PageHeader title="Dashboard" description={`Signed in as ${user.role}`} />
        <PageBody>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {me ? (
              <>
                <Card>
                  <CardContent>
                    <p className="text-xs font-medium text-muted-foreground">Employee no.</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                      {me.employeeNo}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {me.lastName}, {me.firstName}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <p className="text-xs font-medium text-muted-foreground">Position</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight">
                      {me.positionTitle ?? "—"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">Date hired {formatDate(me.dateHired)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <p className="text-xs font-medium text-muted-foreground">Status</p>
                    <div className="mt-2">
                      <StatusBadge status={me.status} />
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    No employee profile linked to this account — see HR.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </PageBody>
      </>
    );
  }

  const activeSince = isoDaysAgo(30);

  const [byStatus, byCampaign, totals, recentHires] = await Promise.all([
    db
      .select({ status: employee.status, n: count() })
      .from(employee)
      .groupBy(employee.status),
    db
      .select({ code: campaign.code, name: campaign.name, n: count() })
      .from(employee)
      .innerJoin(campaign, eq(employee.campaignId, campaign.id))
      .where(eq(employee.status, "ACTIVE"))
      .groupBy(campaign.code, campaign.name)
      .orderBy(desc(count())),
    db
      .select({ n: count(), payroll: sum(employee.baseSalaryMonthly) })
      .from(employee)
      .where(eq(employee.status, "ACTIVE")),
    db
      .select({
        id: employee.id,
        employeeNo: employee.employeeNo,
        firstName: employee.firstName,
        lastName: employee.lastName,
        dateHired: employee.dateHired,
        status: employee.status,
        positionTitle: jobPosition.title,
      })
      .from(employee)
      .leftJoin(jobPosition, eq(employee.positionId, jobPosition.id))
      .orderBy(desc(employee.dateHired))
      .limit(6),
  ]);

  const statusMap = new Map(byStatus.map((r) => [r.status, r.n]));
  const active = statusMap.get("ACTIVE") ?? 0;
  const away = (statusMap.get("ON_LEAVE") ?? 0) + (statusMap.get("SUSPENDED") ?? 0);
  const left = (statusMap.get("TERMINATED") ?? 0) + (statusMap.get("AWOL") ?? 0);
  const headcount = byStatus.reduce((sumRows, r) => sumRows + r.n, 0);
  const payroll = Number(totals[0]?.payroll ?? 0);
  const peak = Math.max(1, ...byCampaign.map((r) => r.n));
  const hiredRecently = await db
    .select({ n: count() })
    .from(employee)
    .where(gte(employee.dateHired, activeSince));

  const cards = [
    { label: "Active headcount", value: String(active), hint: `${headcount} on file` },
    { label: "Away today", value: String(away), hint: "Leave or suspended" },
    { label: "Separated", value: String(left), hint: "Terminated or AWOL" },
    { label: "Monthly base payroll", value: formatPhp(payroll), hint: "Active employees only" },
    { label: "New hires (30d)", value: String(hiredRecently[0]?.n ?? 0), hint: activeSince },
  ];

  return (
    <>
      <PageHeader title="Dashboard" description={`Signed in as ${user.role}`}>
        <Button asChild variant="outline" size="sm">
          <Link href="/employees/new">Add employee</Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/employees">View roster</Link>
        </Button>
      </PageHeader>

      <PageBody>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {cards.map((card) => (
            <Card key={card.label}>
              <CardContent>
                <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                  {card.value}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{card.hint}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm">Headcount by campaign</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5">
              {byCampaign.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active employees yet.</p>
              ) : (
                byCampaign.map((row) => (
                  <div key={row.code}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate font-medium">{row.name}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {row.n} · {Math.round((row.n / Math.max(1, active)) * 100)}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.max(4, (row.n / peak) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Status breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {byStatus.length === 0 ? (
                <p className="text-sm text-muted-foreground">No employees yet.</p>
              ) : (
                [...byStatus]
                  .sort((a, b) => b.n - a.n)
                  .map((row) => (
                    <div key={row.status} className="flex items-center justify-between gap-3">
                      <StatusBadge status={row.status} />
                      <span className="text-sm tabular-nums text-muted-foreground">{row.n}</span>
                    </div>
                  ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-sm">Most recent hires</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee no.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Date hired</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentHires.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        href={`/employees/${row.id}`}
                        className="font-medium hover:underline"
                      >
                        {row.employeeNo}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {row.lastName}, {row.firstName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.positionTitle ?? "—"}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {formatDate(row.dateHired)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
