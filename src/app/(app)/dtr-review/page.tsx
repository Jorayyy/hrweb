import Link from "next/link";
import { and, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { attendanceDay, campaign, department, employee, holidayCalendar } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import {
  addDays,
  dateRange,
  encodeDtrFilter,
  matchFilteredEmployee,
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
import { SubmitButton } from "@/components/submit-button";
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
import { DtrFilters } from "./filters";
import { WeekPicker } from "./week-picker";

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PAGE_SIZE = 25;

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
  searchParams?: Promise<{
    w?: string;
    page?: string;
    error?: string;
    ok?: string;
    campaign?: string;
    dept?: string;
    q?: string;
  }>;
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

  const campaignId = /^\d+$/.test(params.campaign ?? "") ? Number(params.campaign) : 0;
  const deptId = /^\d+$/.test(params.dept ?? "") ? Number(params.dept) : 0;
  const q = (params.q ?? "").trim().toLowerCase().slice(0, 50);
  const filter = { campaignId, deptId, q };
  const filterQS = encodeDtrFilter(filter);

  const [emps, rows, holidayRows, campaigns, departments] = await Promise.all([
    db
      .select({
        id: employee.id,
        employeeNo: employee.employeeNo,
        firstName: employee.firstName,
        lastName: employee.lastName,
        dateHired: employee.dateHired,
        weeklyRestDays: employee.weeklyRestDays,
        campaignId: employee.campaignId,
        departmentId: employee.departmentId,
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
    db.select({ id: campaign.id, name: campaign.name }).from(campaign).orderBy(campaign.name),
    db.select({ id: department.id, name: department.name }).from(department).orderBy(department.name),
  ]);

  const shown = emps.filter((e) => matchFilteredEmployee(filter, e));

  const byEmp = new Map<number, typeof rows>();
  for (const row of rows) {
    const list = byEmp.get(row.employeeId);
    if (list) list.push(row);
    else byEmp.set(row.employeeId, [row]);
  }
  const holidayByDate = new Map(holidayRows.map((h) => [h.holidayDate, h.name]));

  const tableRows = shown.map((emp) => {
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
  const approvableIds = tableRows
    .filter((t) => t.readiness.flagged.length === 0 && !t.readiness.approved)
    .map((t) => t.emp.id);
  const approvableCount = approvableIds.length;
  const actionsEnabled = weekOver && approvableCount > 0;

  const pages = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(params.page) || 1), pages);
  const pageRows = tableRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const pageLink = (target: number) =>
    `/dtr-review?w=${w}${filterQS ? `&${filterQS}` : ""}&page=${target}`;
  return (
    <>
      <PageHeader
        back
        title="DTR Review"
        description={`${weekLabel} · ${formatDate(w)} – ${formatDate(to)} · ${
          filterQS
            ? `${tableRows.length} of ${emps.length} employees`
            : `${tableRows.length} employees`
        } · ${approvedCount} approved`}
      >
        <div className="flex items-center gap-1">
          <Button asChild variant="outline" size="sm">
            <Link href="/payroll">Payroll</Link>
          </Button>
          <WeekPicker w={w} today={todayKey} />
          <form action={approveWeek}>
            <input type="hidden" name="w" value={w} />
            <input type="hidden" name="ids" value={approvableIds.join(",")} />
            <input type="hidden" name="f" value={filterQS} />
            <SubmitButton
              size="sm"
              disabled={!actionsEnabled}
              job={{
                kind: "dtr",
                w,
                f: filterQS,
                from: approvedCount,
                to: approvedCount + approvableCount,
              }}
            >
              Approve all ({approvableCount})
            </SubmitButton>
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

        <DtrFilters campaigns={campaigns} departments={departments} />

        <Card>
          <CardHeader>
            <CardTitle>Week of {formatDate(w)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    {dates.map((d) => (
                      <TableHead key={d} className="text-center">
                        {DAY_SHORT[dateKeyDayOfWeek(d)]} {d.slice(8)}
                      </TableHead>
                    ))}
                    <TableHead className="text-right">Worked h</TableHead>
                    <TableHead className="text-right">Late</TableHead>
                    <TableHead className="text-right">OT h</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map(({ emp, byDate, requiredSet, readiness, totals }) => (
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
                              className={`whitespace-normal text-center align-top text-xs ${
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
                            className={`whitespace-normal align-top text-xs ${
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
                        ) : readiness.approved ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600">Approved</Badge>
                        ) : readiness.missing.length > 0 || readiness.flagged.length > 0 ? (
                          <span className="flex flex-col items-start gap-0.5 text-xs">
                            {readiness.missing.length > 0 ? (
                              <Link
                                href={`/tk?w=${w}&emp=${emp.id}`}
                                className="text-amber-700 underline-offset-2 hover:underline dark:text-amber-400"
                              >
                                {readiness.missing.length} missing →
                              </Link>
                            ) : null}
                            {readiness.flagged.length > 0 ? (
                              <Link
                                href={`/tk?w=${w}&emp=${emp.id}`}
                                className="text-rose-700 underline-offset-2 hover:underline dark:text-rose-400"
                              >
                                {readiness.flagged.length} flagged →
                              </Link>
                            ) : null}
                          </span>
                        ) : !weekOver ? (
                          <span className="text-xs text-muted-foreground">In progress</span>
                        ) : (
                          <Badge variant="secondary">Ready</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {readiness.approved ? (
                          <form action={reopenWeek}>
                            <input type="hidden" name="w" value={w} />
                            <input type="hidden" name="employeeId" value={emp.id} />
                            <input type="hidden" name="f" value={filterQS} />
                            <SubmitButton variant="outline" size="sm">
                              Reopen
                            </SubmitButton>
                          </form>
                        ) : (
                          <form action={approveWeek}>
                            <input type="hidden" name="w" value={w} />
                            <input type="hidden" name="employeeId" value={emp.id} />
                            <input type="hidden" name="f" value={filterQS} />
                            <SubmitButton
                              size="sm"
                              disabled={!weekOver || readiness.flagged.length > 0}
                            >
                              {readiness.missing.length > 0
                                ? `Approve (${readiness.missing.length} absent)`
                                : "Approve"}
                            </SubmitButton>
                          </form>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {pages > 1 ? (
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
                <span className="text-muted-foreground">
                  Page {page} of {pages} · {tableRows.length} employees
                </span>
                <div className="flex gap-2">
                  {page > 1 ? (
                    <Button asChild variant="outline" size="sm">
                      <a href={pageLink(page - 1)}>Previous</a>
                    </Button>
                  ) : null}
                  {page < pages ? (
                    <Button asChild variant="outline" size="sm">
                      <a href={pageLink(page + 1)}>Next</a>
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}

            <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
              Missing = required day with no record (rest days and pre-hire dates excluded) —
              approving marks those days absent; if the employee was actually present, fix the
              punches in Timekeeping (TK) first. Flagged = wrong or incomplete punch — must be
              fixed in TK before approval. Approved days are locked until reopened; payroll
              cannot calculate until every required day is approved.
            </p>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
