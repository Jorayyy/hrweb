import Link from "next/link";
import { and, count, eq, ilike, or } from "drizzle-orm";
import { Pencil, Search } from "lucide-react";
import { db } from "@/db";
import { attendanceDay, attendanceStatus, employee } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { isIsoDate, intOrNull, oneOf } from "@/lib/form";
import { MANILA_OFFSET_MS, manilaDateKey } from "@/lib/time";
import { PageBody, PageHeader } from "@/components/page-header";
import { StatusBadge, humanize } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { selectCx } from "@/components/ui/field";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EntryForm, type EntryInitial } from "./entry-form";

const LIMIT = 200;

function today(): string {
  return manilaDateKey(Date.now());
}

function fmtHM(ts: Date | null): string {
  if (!ts) return "—";
  return new Date(ts.getTime() + MANILA_OFFSET_MS).toISOString().slice(11, 16);
}

function hours(seconds: number): string {
  return (seconds / 3600).toFixed(2);
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string; status?: string; q?: string; edit?: string }>;
}) {
  await requireRole("ADMIN", "HR");

  const params = (await searchParams) ?? {};
  const date = isIsoDate(params.date ?? "") ? (params.date as string) : today();
  const statuses = attendanceStatus.enumValues;
  const activeStatus = oneOf(params.status ?? "", statuses) ? (params.status as string) : "";
  const q = (params.q ?? "").trim();
  const editId = intOrNull(params.edit ?? "");

  const summary = await db
    .select({ status: attendanceDay.status, n: count() })
    .from(attendanceDay)
    .where(eq(attendanceDay.workDate, date))
    .groupBy(attendanceDay.status);

  const conditions = [eq(attendanceDay.workDate, date)];
  if (activeStatus) conditions.push(eq(attendanceDay.status, activeStatus as (typeof statuses)[number]));
  if (q) {
    conditions.push(
      or(
        ilike(employee.firstName, `%${q}%`),
        ilike(employee.lastName, `%${q}%`),
        ilike(employee.employeeNo, `%${q}%`),
      )!,
    );
  }

  const rows = await db
    .select({
      att: attendanceDay,
      id: employee.id,
      employeeNo: employee.employeeNo,
      firstName: employee.firstName,
      lastName: employee.lastName,
    })
    .from(attendanceDay)
    .innerJoin(employee, eq(attendanceDay.employeeId, employee.id))
    .where(and(...conditions))
    .orderBy(employee.lastName, employee.firstName)
    .limit(LIMIT + 1);

  const truncated = rows.length > LIMIT;
  const visible = truncated ? rows.slice(0, LIMIT) : rows;

  const totals = visible.reduce(
    (acc, r) => ({
      worked: acc.worked + r.att.workedSeconds,
      ot: acc.ot + r.att.otWorkedSeconds,
      night: acc.night + r.att.nightSeconds,
      late: acc.late + r.att.lateSeconds,
    }),
    { worked: 0, ot: 0, night: 0, late: 0 },
  );

  const employees = await db
    .select({ id: employee.id, employeeNo: employee.employeeNo, firstName: employee.firstName, lastName: employee.lastName })
    .from(employee)
    .where(
      or(
        eq(employee.status, "ACTIVE"),
        eq(employee.status, "ON_LEAVE"),
        eq(employee.status, "SUSPENDED"),
      )!,
    )
    .orderBy(employee.lastName, employee.firstName)
    .limit(500);

  let initial: EntryInitial | null = null;
  if (editId) {
    const row = await db
      .select()
      .from(attendanceDay)
      .where(and(eq(attendanceDay.employeeId, editId), eq(attendanceDay.workDate, date)))
      .limit(1);
    if (row[0]) {
      initial = {
        employeeId: String(editId),
        workDate: date,
        status: row[0].status,
        punchIn: fmtHM(row[0].punchInUtc) === "—" ? "" : fmtHM(row[0].punchInUtc),
        punchOut: fmtHM(row[0].punchOutUtc) === "—" ? "" : fmtHM(row[0].punchOutUtc),
        scheduledHours: String(row[0].scheduledSeconds / 3600),
      };
    }
  }

  return (
    <>
      <PageHeader
        back
        title="Attendance"
        description={`${rows.length} record${rows.length === 1 ? "" : "s"} on ${date}`}
      />

      <PageBody>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {summary.length === 0 ? (
            <span className="text-sm text-muted-foreground">No entries for this date yet.</span>
          ) : (
            summary.map((s) => (
              <Badge key={s.status} variant="secondary">
                {humanize(s.status)} · {s.n}
              </Badge>
            ))
          )}
        </div>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{initial ? "Edit entry" : "Add entry"}</CardTitle>
            </CardHeader>
            <CardContent>
              <EntryForm
                employees={employees.map((e) => ({
                  id: e.id,
                  label: `${e.lastName}, ${e.firstName} (${e.employeeNo})`,
                }))}
                statuses={statuses}
                date={date}
                initial={initial}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Daily log</CardTitle>
              <form method="get" className="mt-3 flex flex-wrap items-center gap-2">
                <Input name="date" type="date" defaultValue={date} className="w-auto" />
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
                  No attendance rows for these filters.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>In</TableHead>
                      <TableHead>Out</TableHead>
                      <TableHead className="text-right">Sched h</TableHead>
                      <TableHead className="text-right">Worked h</TableHead>
                      <TableHead className="text-right">Late</TableHead>
                      <TableHead className="text-right">OT h</TableHead>
                      <TableHead className="text-right">Night h</TableHead>
                      <TableHead>Flags</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((r) => (
                      <TableRow key={`${r.id}-${r.att.workDate}`}>
                        <TableCell>
                          <Link href={`/employees/${r.id}`} className="hover:underline">
                            <span className="block font-medium">
                              {r.lastName}, {r.firstName}
                            </span>
                            <span className="block text-xs text-muted-foreground">{r.employeeNo}</span>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={r.att.status} />
                        </TableCell>
                        <TableCell className="tabular-nums">{fmtHM(r.att.punchInUtc)}</TableCell>
                        <TableCell className="tabular-nums">{fmtHM(r.att.punchOutUtc)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {hours(r.att.scheduledSeconds)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {hours(r.att.workedSeconds)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.att.lateSeconds > 0 ? `${Math.round(r.att.lateSeconds / 60)}m` : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.att.otWorkedSeconds > 0 ? hours(r.att.otWorkedSeconds) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.att.nightSeconds > 0 ? hours(r.att.nightSeconds) : "—"}
                        </TableCell>
                        <TableCell>
                          <span className="flex flex-wrap gap-1">
                            {r.att.isRestDay ? <Badge variant="outline">Rest</Badge> : null}
                            {r.att.holidayKind !== "NONE" ? (
                              <Badge variant="outline">{humanize(r.att.holidayKind)}</Badge>
                            ) : null}
                            {r.att.needsReview ? (
                              <Badge variant="destructive">Review</Badge>
                            ) : null}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/attendance?date=${date}&edit=${r.id}`} aria-label="Edit">
                              <Pencil />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={6}>Totals</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Math.round(totals.late / 60)}m
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{hours(totals.ot)}</TableCell>
                      <TableCell className="text-right tabular-nums">{hours(totals.night)}</TableCell>
                      <TableCell colSpan={2} />
                    </TableRow>
                  </TableFooter>
                </Table>
              )}

              {truncated ? (
                <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                  Limited to {LIMIT} rows — refine the filters to narrow it down.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
