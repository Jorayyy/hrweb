import Link from "next/link";
import { and, asc, count, desc, eq, gte, isNull, lte, or, sum } from "drizzle-orm";
import { db } from "@/db";
import {
  announcement,
  attendanceDay,
  campaign,
  employee,
  holidayCalendar,
  jobPosition,
  payrollPeriod,
  payrollRun,
  payrollRunItem,
  users,
} from "@/db/schema";
import { requireRole, selfEmployee } from "@/lib/auth";
import { formatDate, formatPhp } from "@/lib/money";
import { manilaDateKey } from "@/lib/time";
import { PageBody, PageHeader } from "@/components/page-header";
import { StatusBadge, humanize } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
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

function nowKey(): string {
  return manilaDateKey(Date.now());
}

function longDate(dateKey: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T12:00:00Z`));
}

export default async function Dashboard() {
  const user = await requireRole();

  if (user.role === "EMPLOYEE") {
    const todayKey = nowKey();
    const monthStart = `${todayKey.slice(0, 7)}-01`;
    const { employeeId } = await selfEmployee();

    const [holidays, upcomingPay, announcements, byCampaign, currentPeriod, latestPayslip, myStats, meRow] =
      await Promise.all([
        db
          .select()
          .from(holidayCalendar)
          .where(gte(holidayCalendar.holidayDate, todayKey))
          .orderBy(asc(holidayCalendar.holidayDate))
          .limit(5),
        db
          .select({ payDate: payrollPeriod.payDate, periodCode: payrollPeriod.periodCode })
          .from(payrollPeriod)
          .where(gte(payrollPeriod.payDate, todayKey))
          .orderBy(asc(payrollPeriod.payDate))
          .limit(1),
        db
          .select({
            id: announcement.id,
            title: announcement.title,
            body: announcement.body,
            pinned: announcement.pinned,
            publishedAt: announcement.publishedAt,
            authorName: users.name,
          })
          .from(announcement)
          .leftJoin(users, eq(announcement.authorId, users.id))
          .where(or(isNull(announcement.expiresAt), gte(announcement.expiresAt, new Date())))
          .orderBy(desc(announcement.pinned), desc(announcement.publishedAt))
          .limit(6),
        db
          .select({ code: campaign.code, name: campaign.name, n: count() })
          .from(employee)
          .innerJoin(campaign, eq(employee.campaignId, campaign.id))
          .where(eq(employee.status, "ACTIVE"))
          .groupBy(campaign.code, campaign.name)
          .orderBy(desc(count())),
        db
          .select({
            periodCode: payrollPeriod.periodCode,
            dateTo: payrollPeriod.dateTo,
            cutoffAt: payrollPeriod.cutoffAt,
          })
          .from(payrollPeriod)
          .where(and(lte(payrollPeriod.dateFrom, todayKey), gte(payrollPeriod.dateTo, todayKey)))
          .limit(1),
        employeeId
          ? db
              .select({
                runId: payrollRun.id,
                periodCode: payrollPeriod.periodCode,
                payDate: payrollPeriod.payDate,
                netPay: payrollRunItem.netPay,
              })
              .from(payrollRunItem)
              .innerJoin(payrollRun, eq(payrollRunItem.runId, payrollRun.id))
              .innerJoin(payrollPeriod, eq(payrollRun.periodId, payrollPeriod.id))
              .where(
                and(
                  eq(payrollRunItem.employeeId, employeeId),
                  eq(payrollRun.status, "POSTED"),
                ),
              )
              .orderBy(desc(payrollPeriod.payDate))
              .limit(1)
          : Promise.resolve([]),
        employeeId
          ? db
              .select({
                worked: sum(attendanceDay.workedSeconds),
                late: sum(attendanceDay.lateSeconds),
                ot: sum(attendanceDay.otWorkedSeconds),
                days: count(),
              })
              .from(attendanceDay)
              .where(
                and(
                  eq(attendanceDay.employeeId, employeeId),
                  gte(attendanceDay.workDate, monthStart),
                  lte(attendanceDay.workDate, todayKey),
                ),
              )
          : Promise.resolve([{ worked: null, late: null, ot: null, days: 0 }]),
        employeeId
          ? db
              .select({
                id: employee.id,
                employeeNo: employee.employeeNo,
                firstName: employee.firstName,
                lastName: employee.lastName,
                positionTitle: jobPosition.title,
              })
              .from(employee)
              .leftJoin(jobPosition, eq(employee.positionId, jobPosition.id))
              .where(eq(employee.id, employeeId))
              .limit(1)
          : Promise.resolve([]),
      ]);

    const me = meRow[0] ?? null;
    const greetingName = me?.firstName ?? user.name?.split(" ")[0] ?? "there";
    const stats = myStats[0];
    const payslip = latestPayslip[0] ?? null;
    const activeTotal = byCampaign.reduce((sumRows, r) => sumRows + r.n, 0);
    const peak = Math.max(1, ...byCampaign.map((r) => r.n));

    const statCards = [
      {
        label: "Hours worked",
        value: stats?.worked != null ? `${(Number(stats.worked) / 3600).toFixed(1)}h` : "—",
        hint: `${monthStart.slice(0, 7)} to date`,
        accent: "",
      },
      {
        label: "Late",
        value: stats?.late != null ? `${Math.round(Number(stats.late) / 60)}m` : "—",
        hint: "This month",
        accent: "text-amber-600 dark:text-amber-400",
      },
      {
        label: "Overtime",
        value: stats?.ot != null ? `${(Number(stats.ot) / 3600).toFixed(1)}h` : "—",
        hint: "This month",
        accent: "text-blue-600 dark:text-blue-400",
      },
      {
        label: "Days with record",
        value: stats ? String(stats.days) : "—",
        hint: "This month",
        accent: "text-emerald-600 dark:text-emerald-400",
      },
    ];

    return (
      <>
        <PageHeader
          title={`Welcome back, ${greetingName}`}
          description={
            me ? `${longDate(todayKey)} · ${me.employeeNo} · ${me.positionTitle ?? "—"}` : longDate(todayKey)
          }
        >
          {me ? <StatusBadge status="ACTIVE" /> : null}
        </PageHeader>

        <PageBody>
          {me ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {statCards.map((card) => (
                <Card key={card.label}>
                  <CardContent>
                    <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
                    <p className={`mt-1 text-2xl font-semibold tracking-tight tabular-nums ${card.accent}`}>
                      {card.value}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{card.hint}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6 text-sm text-muted-foreground">
                No employee profile linked to this account — see HR.
              </CardContent>
            </Card>
          )}

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Announcements</CardTitle>
              </CardHeader>
              <CardContent>
                {announcements.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No announcements yet — stay tuned.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {announcements.map((a) => (
                      <li key={a.id} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{a.title}</span>
                          {a.pinned ? <Badge variant="secondary">Pinned</Badge> : null}
                          <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
                            {a.authorName ?? "HR"} · {formatDate(a.publishedAt.toISOString().slice(0, 10))}
                          </span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payroll calendar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Next pay day</p>
                  <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">
                    {upcomingPay[0] ? formatDate(upcomingPay[0].payDate) : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {upcomingPay[0]?.periodCode ?? "No period scheduled"}
                  </p>
                </div>
                <div className="border-t border-border pt-3">
                  <p className="text-xs font-medium text-muted-foreground">Current cutoff</p>
                  {currentPeriod[0] ? (
                    <p className="mt-1">
                      <span className="font-medium">{currentPeriod[0].periodCode}</span>
                      <span className="text-muted-foreground"> · closes {formatDate(currentPeriod[0].dateTo)}</span>
                    </p>
                  ) : (
                    <p className="mt-1 text-muted-foreground">No open period.</p>
                  )}
                </div>
                {payslip ? (
                  <div className="border-t border-border pt-3">
                    <p className="text-xs font-medium text-muted-foreground">Latest payslip</p>
                    <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatPhp(payslip.netPay)}
                    </p>
                    <p className="text-xs text-muted-foreground">{payslip.periodCode} · net pay</p>
                    <Button asChild variant="outline" size="sm" className="mt-2">
                      <Link href="/payslips">View payslips</Link>
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Upcoming holidays</CardTitle>
              </CardHeader>
              <CardContent>
                {holidays.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No upcoming holidays on the calendar.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {holidays.map((h) => (
                      <li key={h.id} className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{h.name}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(h.holidayDate)}</p>
                        </div>
                        <Badge variant={h.kind === "REGULAR" ? "default" : "secondary"}>
                          {humanize(h.kind)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Company snapshot</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex flex-wrap items-baseline gap-x-3">
                  <span className="text-3xl font-semibold tracking-tight tabular-nums">{activeTotal}</span>
                  <span className="text-sm text-muted-foreground">active employees across {byCampaign.length} campaigns</span>
                </div>
                <div className="space-y-3.5">
                  {byCampaign.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No active employees yet.</p>
                  ) : (
                    byCampaign.map((row) => (
                      <div key={row.code}>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="truncate font-medium">{row.name}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {row.n} · {Math.round((row.n / Math.max(1, activeTotal)) * 100)}%
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
                </div>
              </CardContent>
            </Card>
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
