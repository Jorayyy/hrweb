import Link from "next/link";
import { and, eq, gte, lte } from "drizzle-orm";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@/db";
import { attendanceDay } from "@/db/schema";
import { selfEmployee } from "@/lib/auth";
import { MANILA_OFFSET_MS, manilaDateKey } from "@/lib/time";
import { PageBody, PageHeader } from "@/components/page-header";
import { StatusBadge, humanize } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmtHM(ts: Date | null): string {
  if (!ts) return "—";
  return new Date(ts.getTime() + MANILA_OFFSET_MS).toISOString().slice(11, 16);
}

function hours(seconds: number): string {
  return (seconds / 3600).toFixed(2);
}

function monthKey(offset: number): string {
  const now = manilaDateKey(Date.now());
  return shiftMonth(now.slice(0, 7), offset);
}

function shiftMonth(m: string, offset: number): string {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + offset, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, mo - 1, 1)),
  );
}

export default async function DtrPage({
  searchParams,
}: {
  searchParams?: Promise<{ m?: string }>;
}) {
  const { user, employeeId } = await selfEmployee();
  const params = (await searchParams) ?? {};
  const m = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.m ?? "")
    ? (params.m as string)
    : monthKey(0);

  if (!employeeId) {
    return (
      <>
        <PageHeader title="My DTR" description={`Signed in as ${user.role}`} />
        <PageBody>
          <Card className="mx-auto max-w-xl">
            <CardContent className="pt-6 text-sm text-muted-foreground">
              No employee profile linked to this account — see HR.
            </CardContent>
          </Card>
        </PageBody>
      </>
    );
  }

  const [y, mo] = m.split("-").map(Number);
  const firstDay = `${m}-01`;
  const lastDayNum = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const lastDay = `${m}-${String(lastDayNum).padStart(2, "0")}`;

  const rows = await db
    .select()
    .from(attendanceDay)
    .where(
      and(
        eq(attendanceDay.employeeId, employeeId),
        gte(attendanceDay.workDate, firstDay),
        lte(attendanceDay.workDate, lastDay),
      ),
    )
    .orderBy(attendanceDay.workDate);

  const byDate = new Map(rows.map((r) => [r.workDate, r]));
  const days = Array.from({ length: lastDayNum }, (_, i) => {
    const key = `${m}-${String(i + 1).padStart(2, "0")}`;
    return { key, dow: new Date(Date.UTC(y, mo - 1, i + 1)).getUTCDay(), row: byDate.get(key) };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      sched: acc.sched + r.scheduledSeconds,
      worked: acc.worked + r.workedSeconds,
      ot: acc.ot + r.otWorkedSeconds,
      late: acc.late + r.lateSeconds,
    }),
    { sched: 0, worked: 0, ot: 0, late: 0 },
  );

  return (
    <>
      <PageHeader
        title="My DTR"
        description={`${monthLabel(m)} · ${rows.length} record${rows.length === 1 ? "" : "s"}`}
      >
        <div className="flex items-center gap-1">
          <Button asChild variant="outline" size="sm">
            <Link href={`/dtr?m=${shiftMonth(m, -1)}`} aria-label="Previous month">
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/dtr?m=${shiftMonth(m, 1)}`} aria-label="Next month">
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        </div>
      </PageHeader>

      <PageBody>
        <Card>
          <CardHeader>
            <CardTitle>Daily time record</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>In</TableHead>
                  <TableHead>Out</TableHead>
                  <TableHead className="text-right">Sched h</TableHead>
                  <TableHead className="text-right">Worked h</TableHead>
                  <TableHead className="text-right">Late</TableHead>
                  <TableHead className="text-right">OT h</TableHead>
                  <TableHead>Flags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {days.map(({ key, dow, row }) => (
                  <TableRow key={key}>
                    <TableCell className="tabular-nums">{key}</TableCell>
                    <TableCell className="text-muted-foreground">{DAY_NAMES[dow]}</TableCell>
                    <TableCell>
                      {row ? (
                        <StatusBadge status={row.status} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">{row ? fmtHM(row.punchInUtc) : "—"}</TableCell>
                    <TableCell className="tabular-nums">{row ? fmtHM(row.punchOutUtc) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row ? hours(row.scheduledSeconds) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row ? hours(row.workedSeconds) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row && row.lateSeconds > 0 ? `${Math.round(row.lateSeconds / 60)}m` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row && row.otWorkedSeconds > 0 ? hours(row.otWorkedSeconds) : "—"}
                    </TableCell>
                    <TableCell>
                      <span className="flex flex-wrap gap-1">
                        {row?.isRestDay ? <Badge variant="outline">Rest</Badge> : null}
                        {row && row.holidayKind !== "NONE" ? (
                          <Badge variant="outline">{humanize(row.holidayKind)}</Badge>
                        ) : null}
                        {row?.needsReview ? <Badge variant="destructive">Review</Badge> : null}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5}>Totals</TableCell>
                  <TableCell className="text-right tabular-nums">{hours(totals.sched)}</TableCell>
                  <TableCell className="text-right tabular-nums">{hours(totals.worked)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Math.round(totals.late / 60)}m
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{hours(totals.ot)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
            <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
              Days with no record show “—”. Missing days are not finalized until attendance is
              processed by HR — corrections go through HR.
            </p>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
