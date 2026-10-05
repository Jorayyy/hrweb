import Link from "next/link";
import { and, gte, inArray, lte } from "drizzle-orm";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@/db";
import { attendanceDay, employee, holidayCalendar } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import {
  addDays,
  dateRange,
  mondayOf,
  requiredDates,
  weekReadiness,
} from "@/lib/attendance/review";
import { dateKeyDayOfWeek } from "@/lib/attendance/anchor";
import { isIsoDate } from "@/lib/form";
import { formatDate } from "@/lib/money";
import { isoWeek, manilaDateKey } from "@/lib/time";
import { PageBody, PageHeader } from "@/components/page-header";
import { humanize } from "@/components/status-badge";
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
import { approveWeek, reopenWeek } from "./actions";

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function nowKey(): string {
  return manilaDateKey(Date.now());
}

function fmtHM(ts: Date | null): string {
  if (!ts) return "—";
  return new Date(ts.getTime() + 8 * 3600_000).toISOString().slice(11, 16);
}

function hours(seconds: number): string {
  return (seconds / 3600).toFixed(2);
}

export default async function DtrReviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ w?: string; error?: string; ok?: string }>;
}) {
  await requireRole("ADMIN", "HR");

  const params = (await searchParams) ?? {};
  const todayKey = nowKey();
  const defaultW = addDays(mondayOf(todayKey), -7);
  const w = isIsoDate(params.w ?? "") && mondayOf(params.w as string) === params.w
    ? (params.w as string)
    : defaultW;
  const to = addDays(w, 6);
  const weekOver = todayKey > to;
  const dates = dateRange(w, to);
  const weekLabel = (() => {
    const { year, week } = isoWeek(Date.parse(`${w}T12:00:00Z`));
    return `${year}-W${String(week).padStart(2, "0")}`;
  })();

  const [emps, rows, holidayRows] = await Promise.all([
    db
      .select({
        id: employee.id,
        employeeNo: employee.employeeNo,
        firstName: employee.firstName,
        lastName: employee.lastName,
        dateHired: employee.dateHired,
        weeklyRestDays: employee.weeklyRestDays,
      })
      .from(employee)
      .where(inArray(employee.status, ["ACTIVE", "ON_LEAVE"]))
      .orderBy(employee.lastName, employee.firstName),
    db
      .select()
      .from(attendanceDay)
      .where(and(gte(attendanceDay.workDate, w), lte(attendanceDay.workDate, to))),
    db
      .select()
      .from(holidayCalendar)
      .where(and(gte(holidayCalendar.holidayDate, w), lte(holidayCalendar.holidayDate, to))),
  ]);

  const byEmp = new Map<number, typeof rows>();
  for (const row of rows) {
    const list = byEmp.get(row.employeeId);
    if (list) list.push(row);
    else byEmp.set(row.employeeId, [row]);
  }
  const holidayByDate = new Map(holidayRows.map((h) => [h.holidayDate, h.name]));

  const tableRows = emps.map((emp) => {
    const empRows = byEmp.get(emp.id) ?? [];
    const byDate = new Map(empRows.map((r) => [r.workDate, r]));
    const required = requiredDates({
      from: w,
      to,
      dateHired: emp.dateHired,
      weeklyRestDays: emp.weeklyRestDays,
    });
    const readiness = weekReadiness(required, empRows);
    const totals = empRows.reduce(
      (acc, r) => ({
        worked: acc.worked + r.workedSeconds,
        late: acc.late + r.lateSeconds,
        ot: acc.ot + r.otWorkedSeconds,
      }),
      { worked: 0, late: 0, ot: 0 },
    );
    return { emp, byDate, required, requiredSet: new Set(required), readiness, totals };
  });

  const approvedCount = tableRows.filter((t) => t.readiness.approved).length;
  const readyCount = tableRows.filter((t) => t.readiness.ready && !t.readiness.approved).length;
  const actionsEnabled = weekOver && readyCount > 0;

  const weekLink = (monday: string) => `/dtr-review?w=${monday}`;

  return (
    <>
      <PageHeader
        back
        title="DTR Review"
        description={`${weekLabel} · ${formatDate(w)} – ${formatDate(to)} · ${tableRows.length} employees · ${approvedCount} approved`}
      >
        <div className="flex items-center gap-1">
          <Button asChild variant="outline" size="sm">
            <Link href={weekLink(addDays(w, -7))} aria-label="Previous week">
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={weekLink(addDays(w, 7))} aria-label="Next week">
              <ChevronRight className="size-4" />
            </Link>
          </Button>
          <form action={approveWeek}>
            <input type="hidden" name="w" value={w} />
            <Button type="submit" size="sm" disabled={!actionsEnabled}>
              Approve all ready ({readyCount})
            </Button>
          </form>
        </div>
      </PageHeader>

      <PageBody>
        {params.error ? (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {params.error}
          </div>
        ) : null}
        {params.ok ? (
          <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
            {params.ok}
          </div>
        ) : null}

        {!weekOver ? (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            This week has not ended yet — approval opens after {formatDate(to)}.
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Week of {formatDate(w)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-44">Employee</TableHead>
                    {dates.map((d) => (
                      <TableHead key={d} className="min-w-24 text-center">
                        {DAY_SHORT[dateKeyDayOfWeek(d)]} {d.slice(8)}
                      </TableHead>
                    ))}
                    <TableHead className="text-right">Worked h</TableHead>
                    <TableHead className="text-right">Late</TableHead>
                    <TableHead className="text-right">OT h</TableHead>
                    <TableHead className="min-w-32">Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableRows.map(({ emp, byDate, requiredSet, readiness, totals }) => (
                    <TableRow key={emp.id}>
                      <TableCell>
                        <Link href={`/employees/${emp.id}`} className="hover:underline">
                          <span className="block font-medium">
                            {emp.lastName}, {emp.firstName}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {emp.employeeNo}
                          </span>
                        </Link>
                      </TableCell>
                      {dates.map((d) => {
                        const row = byDate.get(d);
                        const holiday = holidayByDate.get(d);
                        const required = requiredSet.has(d);
                        if (!row) {
                          const isRest = emp.weeklyRestDays.includes(dateKeyDayOfWeek(d));
                          return (
                            <TableCell
                              key={d}
                              className={`text-center align-top text-xs ${
                                required
                                  ? "border border-dashed border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {required ? "Missing" : isRest ? "Rest" : "·"}
                              {holiday ? (
                                <span className="mt-0.5 block truncate text-[10px] text-violet-600 dark:text-violet-400">
                                  {holiday}
                                </span>
                              ) : null}
                            </TableCell>
                          );
                        }
                        return (
                          <TableCell
                            key={d}
                            className={`align-top text-xs ${
                              row.reviewedAt
                                ? "bg-emerald-50 dark:bg-emerald-950/30"
                                : "bg-background"
                            }`}
                          >
                            <span className="block tabular-nums">
                              {row.punchInUtc || row.punchOutUtc
                                ? `${fmtHM(row.punchInUtc)}–${fmtHM(row.punchOutUtc)}`
                                : humanize(row.status)}
                            </span>
                            <span className="block text-muted-foreground tabular-nums">
                              {hours(row.workedSeconds)}h
                              {row.lateSeconds > 0
                                ? ` · ${Math.round(row.lateSeconds / 60)}m late`
                                : ""}
                            </span>
                            <span className="mt-0.5 flex flex-wrap gap-0.5">
                              {row.needsReview ? (
                                <span className="rounded bg-rose-100 px-1 text-[10px] text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                                  Flagged
                                </span>
                              ) : null}
                              {row.reviewedAt ? (
                                <span className="rounded bg-emerald-100 px-1 text-[10px] text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                  Reviewed
                                </span>
                              ) : null}
                            </span>
                            {holiday ? (
                              <span className="mt-0.5 block truncate text-[10px] text-violet-600 dark:text-violet-400">
                                {holiday}
                              </span>
                            ) : null}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right text-xs tabular-nums">
                        {hours(totals.worked)}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {totals.late > 0 ? `${Math.round(totals.late / 60)}m` : "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {totals.ot > 0 ? hours(totals.ot) : "—"}
                      </TableCell>
                      <TableCell>
                        {requiredSet.size === 0 ? (
                          <Badge variant="outline">N/A</Badge>
                        ) : !weekOver ? (
                          <span className="text-xs text-muted-foreground">In progress</span>
                        ) : readiness.approved ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600">Approved</Badge>
                        ) : readiness.ready ? (
                          <Badge variant="secondary">Ready</Badge>
                        ) : readiness.missing.length > 0 ? (
                          <Link
                            href={`/attendance?date=${readiness.missing[0]}`}
                            className="text-xs text-amber-700 underline-offset-2 hover:underline dark:text-amber-400"
                          >
                            {readiness.missing.length} missing →
                          </Link>
                        ) : (
                          <Link
                            href={`/attendance?date=${readiness.flagged[0]}`}
                            className="text-xs text-rose-700 underline-offset-2 hover:underline dark:text-rose-400"
                          >
                            {readiness.flagged.length} flagged →
                          </Link>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {readiness.approved ? (
                          <form action={reopenWeek}>
                            <input type="hidden" name="w" value={w} />
                            <input type="hidden" name="employeeId" value={emp.id} />
                            <Button type="submit" variant="outline" size="sm">
                              Reopen
                            </Button>
                          </form>
                        ) : (
                          <form action={approveWeek}>
                            <input type="hidden" name="w" value={w} />
                            <input type="hidden" name="employeeId" value={emp.id} />
                            <Button
                              type="submit"
                              size="sm"
                              disabled={!weekOver || !readiness.ready}
                            >
                              Approve
                            </Button>
                          </form>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
              Missing = required day with no record (rest days and pre-hire dates excluded) —
              backfill it in Attendance. Flagged = incomplete punch or anomaly to fix. Approved
              days are locked until reopened; payroll cannot calculate until every required day
              is approved.
            </p>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
