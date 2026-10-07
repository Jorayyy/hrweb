import Link from "next/link";
import { and, gte, inArray, lte } from "drizzle-orm";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@/db";
import { attendanceDay, campaign, costCenter, department, employee, shiftTemplate } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import {
  addDays,
  employeeFilterConditions,
  encodeDtrFilter,
  mondayOf,
  parseDtrFilter,
  requiredDates,
} from "@/lib/attendance/review";
import { isIsoDate } from "@/lib/form";
import { formatDate } from "@/lib/money";
import { isoWeek, MANILA_OFFSET_MS, manilaDateKey } from "@/lib/time";
import { EmployeeFilters } from "@/components/employee-filters";
import { PageBody, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { markAbsent, savePunches } from "./actions";

const PAGE_SIZE = 25;
const PUNCH_STATUSES = ["PRESENT", "HALF_DAY", "REST_DAY_WORKED"] as const;

type Row = typeof attendanceDay.$inferSelect;

const PUNCH_LABELS: { name: string; label: string }[] = [
  { name: "punchIn", label: "In" },
  { name: "break1Out", label: "1st break out" },
  { name: "break1In", label: "1st break in" },
  { name: "lunchOut", label: "Lunch out" },
  { name: "lunchIn", label: "Lunch in" },
  { name: "break2Out", label: "2nd break out" },
  { name: "break2In", label: "2nd break in" },
  { name: "punchOut", label: "Out" },
];

function fmtHM(ts: Date | null): string {
  if (!ts) return "";
  return new Date(ts.getTime() + MANILA_OFFSET_MS).toISOString().slice(11, 16);
}

function nowKey(): string {
  return manilaDateKey(Date.now());
}

function punchValue(row: Row | null, name: string): string {
  if (!row) return "";
  const v = row[`${name}Utc` as keyof Row];
  return v instanceof Date ? fmtHM(v) : "";
}

function fieldsFor(shift: (typeof shiftTemplate.$inferSelect) | null): typeof PUNCH_LABELS {
  if (!shift) return [PUNCH_LABELS[0], PUNCH_LABELS[7]];
  const keep = new Set(["punchIn", "punchOut", "lunchOut", "lunchIn"]);
  if (shift.break1Start) {
    keep.add("break1Out");
    keep.add("break1In");
  }
  if (shift.break2Start) {
    keep.add("break2Out");
    keep.add("break2In");
  }
  return PUNCH_LABELS.filter((f) => keep.has(f.name));
}

export default async function TimekeepingPage({
  searchParams,
}: {
  searchParams?: Promise<{
    w?: string;
    page?: string;
    emp?: string;
    q?: string;
    campaign?: string;
    dept?: string;
    cc?: string;
    error?: string;
    ok?: string;
  }>;
}) {
  await requireRole("ADMIN", "HR");

  const params = (await searchParams) ?? {};
  const todayKey = nowKey();
  const w = isIsoDate(params.w ?? "") && mondayOf(params.w as string) === params.w
    ? (params.w as string)
    : mondayOf(todayKey);
  const to = addDays(w, 6);
  const empFilter = /^\d+$/.test(params.emp ?? "") ? Number(params.emp) : null;
  const filter = parseDtrFilter(params);
  const weekLabel = (() => {
    const { year, week } = isoWeek(Date.parse(`${w}T12:00:00Z`));
    return `${year}-W${String(week).padStart(2, "0")}`;
  })();

  const [emps, rows, shifts, campaigns, departments, costCenters] = await Promise.all([
    db
      .select({
        id: employee.id,
        employeeNo: employee.employeeNo,
        firstName: employee.firstName,
        lastName: employee.lastName,
        dateHired: employee.dateHired,
        weeklyRestDays: employee.weeklyRestDays,
        shiftTemplateId: employee.shiftTemplateId,
      })
      .from(employee)
      .where(
        and(inArray(employee.status, ["ACTIVE", "ON_LEAVE"]), ...employeeFilterConditions(filter)),
      )
      .orderBy(employee.lastName, employee.firstName),
    db
      .select()
      .from(attendanceDay)
      .where(and(gte(attendanceDay.workDate, w), lte(attendanceDay.workDate, to))),
    db.select().from(shiftTemplate),
    db.select({ id: campaign.id, name: campaign.name }).from(campaign).orderBy(campaign.name),
    db.select({ id: department.id, name: department.name }).from(department).orderBy(department.name),
    db.select({ id: costCenter.id, name: costCenter.name }).from(costCenter).orderBy(costCenter.name),
  ]);

  const byEmp = new Map<number, Row[]>();
  for (const row of rows) {
    const list = byEmp.get(row.employeeId);
    if (list) list.push(row);
    else byEmp.set(row.employeeId, [row]);
  }
  const shiftById = new Map(shifts.map((s) => [s.id, s]));

  const issues = emps
    .filter((e) => empFilter === null || e.id === empFilter)
    .flatMap((emp) => {
      const empRows = byEmp.get(emp.id) ?? [];
      const byDate = new Map(empRows.map((r) => [r.workDate, r]));
      const required = requiredDates({
        from: w,
        to,
        dateHired: emp.dateHired,
        weeklyRestDays: emp.weeklyRestDays,
      });
      const days = [
        ...required.filter((d) => !byDate.has(d)).map((date) => ({ date, row: null as Row | null })),
        ...empRows
          .filter((r) => r.needsReview)
          .map((r) => ({ date: r.workDate, row: r as Row | null })),
      ].sort((a, b) => (a.date < b.date ? -1 : 1));
      if (days.length === 0) return [];
      return [{ emp, days, shift: emp.shiftTemplateId ? shiftById.get(emp.shiftTemplateId) ?? null : null }];
    });

  const totalMissing = issues.reduce((n, i) => n + i.days.filter((d) => !d.row).length, 0);
  const totalFlagged = issues.reduce((n, i) => n + i.days.filter((d) => d.row).length, 0);

  const pages = Math.max(1, Math.ceil(issues.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(params.page) || 1), pages);
  const pageIssues = issues.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const filterQS = encodeDtrFilter(filter);
  const filterQs = (opts: { week?: string; page?: number } = {}): string => {
    const qs = new URLSearchParams(filterQS);
    qs.set("w", opts.week ?? w);
    if (opts.page) qs.set("page", String(opts.page));
    if (empFilter !== null) qs.set("emp", String(empFilter));
    return `/tk?${qs.toString()}`;
  };
  const weekLink = (monday: string) => filterQs({ week: monday });
  const pageLink = (target: number) => filterQs({ page: target });

  return (
    <>
      <PageHeader
        back
        title="Timekeeping"
        description={`${weekLabel} · ${formatDate(w)} – ${formatDate(to)} · ${issues.length} employees with issues · ${totalMissing} missing · ${totalFlagged} flagged`}
      >
        <div className="flex items-center gap-1">
          <Button asChild variant="outline" size="sm">
            <Link href={`/dtr-review?w=${w}`}>DTR Review</Link>
          </Button>
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

        {empFilter !== null ? (
          <div className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <span className="truncate">Filtered to one employee.</span>
            <Link
              href={`/tk?w=${w}${filterQS ? `&${filterQS}` : ""}`}
              className="shrink-0 text-sm underline-offset-2 hover:underline"
            >
              Clear
            </Link>
          </div>
        ) : null}

        <div className="mb-4">
          <EmployeeFilters
            campaigns={campaigns}
            departments={departments}
            costCenters={costCenters}
          />
        </div>

        {issues.length === 0 ? (
          <Card>
            <CardContent>
              <p className="py-10 text-center text-sm text-muted-foreground">
                {filter.q ? `No employees with issues match “${filter.q}”.` : "No missing or flagged days this week."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {pageIssues.map(({ emp, days, shift }) => {
              const fields = fieldsFor(shift);
              return (
                <Card key={emp.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2 text-base">
                      <Link href={`/employees/${emp.id}`} className="truncate hover:underline">
                        {emp.lastName}, {emp.firstName}{" "}
                        <span className="font-normal text-muted-foreground">
                          · {emp.employeeNo}
                        </span>
                      </Link>
                      <span className="flex shrink-0 items-center gap-1">
                        <Badge
                          variant="outline"
                          className="border-amber-300 text-amber-700 dark:border-amber-900 dark:text-amber-400"
                        >
                          {days.filter((d) => !d.row).length} missing
                        </Badge>
                        <Badge
                          variant="outline"
                          className="border-rose-300 text-rose-700 dark:border-rose-900 dark:text-rose-400"
                        >
                          {days.filter((d) => d.row).length} flagged
                        </Badge>
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {days.map(({ date, row }) => {
                      const status =
                        row && (PUNCH_STATUSES as readonly string[]).includes(row.status)
                          ? row.status
                          : "PRESENT";
                      return (
                        <div
                          key={date}
                          className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border py-2 first:border-t-0 first:pt-0"
                        >
                          <span className="w-28 shrink-0 text-xs font-medium">
                            {formatDate(date)}
                          </span>
                          {row ? (
                            <Badge variant="destructive" className="text-[10px]">
                              Flagged
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-amber-300 text-[10px] text-amber-700 dark:border-amber-900 dark:text-amber-400"
                            >
                              Missing
                            </Badge>
                          )}
                          {row?.reviewNote ? (
                            <span className="text-xs text-muted-foreground">{row.reviewNote}</span>
                          ) : null}
                          <form
                            action={savePunches}
                            className="ml-auto flex flex-wrap items-center gap-1.5"
                          >
                            <input type="hidden" name="w" value={w} />
                            <input type="hidden" name="employeeId" value={emp.id} />
                            <input type="hidden" name="workDate" value={date} />
                            <input type="hidden" name="status" value={status} />
                            {fields.map((f) => (
                              <label
                                key={f.name}
                                className="flex flex-col gap-0.5 text-[10px] text-muted-foreground"
                              >
                                {f.label}
                                <Input
                                  type="time"
                                  name={f.name}
                                  defaultValue={punchValue(row, f.name)}
                                  className="h-7 w-24 px-1.5 text-xs"
                                />
                              </label>
                            ))}
                            <Button
                              type="submit"
                              size="sm"
                              variant="secondary"
                              className="mt-3 h-7"
                            >
                              Save punches
                            </Button>
                          </form>
                          <form action={markAbsent}>
                            <input type="hidden" name="w" value={w} />
                            <input type="hidden" name="employeeId" value={emp.id} />
                            <input type="hidden" name="workDate" value={date} />
                            <Button
                              type="submit"
                              size="sm"
                              variant="outline"
                              className="h-7 text-rose-700 hover:text-rose-800 dark:text-rose-400"
                            >
                              Mark absent
                            </Button>
                          </form>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {pages > 1 ? (
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
            <span className="text-muted-foreground">
              Page {page} of {pages} · {issues.length} employees
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
          Missing = required day with no record. Save punches if the employee was present (fill
          every field the shift requires or the day stays flagged), or mark absent if they were
          not. Fixed days unlock approval in DTR Review.
        </p>
      </PageBody>
    </>
  );
}
