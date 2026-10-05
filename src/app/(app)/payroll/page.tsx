import { count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { employee, payrollPeriod, payrollRun, payrollRunItem } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { formatDate, formatPhp } from "@/lib/money";
import { PageBody, PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { CalculateButton } from "./calculate-button";
import { calculateRun, createRun, openPeriod, transitionRun } from "./actions";

const PAGE_SIZE = 25;

export default async function PayrollPage({
  searchParams,
}: {
  searchParams?: Promise<{ period?: string; run?: string; page?: string; error?: string }>;
}) {
  await requireRole("ADMIN", "PAYROLL");

  const params = (await searchParams) ?? {};
  const error = (params.error ?? "").trim();

  const periods = await db
    .select()
    .from(payrollPeriod)
    .orderBy(desc(payrollPeriod.dateFrom))
    .limit(12);

  const periodId = Number(params.period) || periods[0]?.id || 0;
  const period = periods.find((p) => p.id === periodId) ?? null;

  const runs = period
    ? await db
        .select()
        .from(payrollRun)
        .where(eq(payrollRun.periodId, period.id))
        .orderBy(desc(payrollRun.runNo))
    : [];
  const run = runs.find((r) => r.id === Number(params.run)) ?? runs[0] ?? null;

  const totalItems = run
    ? (
        await db
          .select({ n: count() })
          .from(payrollRunItem)
          .where(eq(payrollRunItem.runId, run.id))
      )[0].n
    : 0;
  const pages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(params.page) || 1), pages);

  const items =
    run && period
      ? await db
          .select({
            item: payrollRunItem,
            firstName: employee.firstName,
            lastName: employee.lastName,
            employeeNo: employee.employeeNo,
          })
          .from(payrollRunItem)
          .leftJoin(employee, eq(payrollRunItem.employeeId, employee.id))
          .where(eq(payrollRunItem.runId, run.id))
          .orderBy(employee.lastName, employee.firstName)
          .limit(PAGE_SIZE)
          .offset((page - 1) * PAGE_SIZE)
      : [];

  const registerHref = (target: number) =>
    `/payroll?period=${periodId}&run=${run?.id ?? ""}&page=${target}`;

  return (
    <>
      <PageHeader
        back
        title="Payroll"
        description="Periods, cutoff runs, registers and payslips"
      >
        <form action={openPeriod} className="flex items-center gap-2">
          <select name="frequency" defaultValue="SEMI_MONTHLY" className={`${selectCx} h-8 w-40`}>
            <option value="SEMI_MONTHLY">Semi-monthly</option>
            <option value="WEEKLY">Weekly</option>
          </select>
          <Button type="submit" size="sm">
            Open cutoff
          </Button>
        </form>
      </PageHeader>

      <PageBody>
        {error ? (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Cutoff periods</CardTitle>
              <CardDescription>
                Semi-monthly: 1–15th (pay 25th) and 16–last day (pay 10th). Weekly: Mon–Sun, paid
                7 days after cutoff.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {periods.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No periods yet — open the next cutoff to begin.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Pay date</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead className="text-right">Runs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {periods.map((p) => (
                      <TableRow
                        key={p.id}
                        className={p.id === periodId ? "bg-muted/50" : undefined}
                      >
                        <TableCell>
                          <a
                            href={`/payroll?period=${p.id}`}
                            className="font-medium hover:underline"
                          >
                            {p.periodCode}
                          </a>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(p.dateFrom)} – {formatDate(p.dateTo)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(p.payDate)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{p.frequency}</TableCell>
                        <TableCell className="text-right">
                          <form
                            action={createRun.bind(null, p.id)}
                            className="inline-flex items-center gap-2"
                          >
                            <span className="text-muted-foreground">
                              {runs.length > 0 && p.id === periodId ? runs.length : "—"}
                            </span>
                            <Button type="submit" variant="outline" size="sm">
                              New run
                            </Button>
                          </form>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {period && runs.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Runs — {period.periodCode}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Run</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Headcount</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Deductions</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.map((r) => {
                      const selected = run?.id === r.id;
                      const mutable = r.status !== "POSTED" && r.status !== "VOID";
                      const recalculable = ["OPEN", "CUT_OFF", "CALCULATED", "REVIEW"].includes(
                        r.status,
                      );
                      return (
                        <TableRow key={r.id} className={selected ? "bg-muted/50" : undefined}>
                          <TableCell>
                            <a
                              href={`/payroll?period=${period.id}&run=${r.id}`}
                              className="font-medium hover:underline"
                            >
                              #{r.runNo}
                            </a>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={r.status} />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {r.headcount ?? "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {r.grossTotal != null ? formatPhp(r.grossTotal) : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {r.deductionTotal != null ? formatPhp(r.deductionTotal) : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {r.netTotal != null ? formatPhp(r.netTotal) : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {selected && recalculable ? (
                                <CalculateButton
                                  action={calculateRun.bind(null, period.id, r.id)}
                                  runId={r.id}
                                />
                              ) : null}
                              {selected && ["CALCULATED", "REVIEW"].includes(r.status) ? (
                                <form
                                  action={transitionRun.bind(null, period.id, r.id, "approve")}
                                >
                                  <Button type="submit" variant="outline" size="sm">
                                    Approve
                                  </Button>
                                </form>
                              ) : null}
                              {selected && r.status === "APPROVED" ? (
                                <form action={transitionRun.bind(null, period.id, r.id, "post")}>
                                  <Button type="submit" size="sm">
                                    Post
                                  </Button>
                                </form>
                              ) : null}
                              {selected && mutable ? (
                                <form action={transitionRun.bind(null, period.id, r.id, "void")}>
                                  <Button type="submit" variant="ghost" size="sm">
                                    Void
                                  </Button>
                                </form>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}

          {run && period ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  Register — {period.periodCode} run #{run.runNo}
                </CardTitle>
                <CardDescription>
                  {totalItems} employee{totalItems === 1 ? "" : "s"} · pay date{" "}
                  {formatDate(period.payDate)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    Run has no calculated rows yet — hit Calculate above.
                  </p>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead className="text-right">Days</TableHead>
                          <TableHead className="text-right">Abs</TableHead>
                          <TableHead className="text-right">OT h</TableHead>
                          <TableHead className="text-right">NSD h</TableHead>
                          <TableHead className="text-right">Gross</TableHead>
                          <TableHead className="text-right">Deductions</TableHead>
                          <TableHead className="text-right">Net pay</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((r) => {
                          const otHours =
                            r.item.hoursOtOrd +
                            r.item.hoursOtRd +
                            r.item.hoursOtSpecl +
                            r.item.hoursOtRh +
                            r.item.hoursOtRhRd;
                          return (
                            <TableRow key={r.item.employeeId}>
                              <TableCell>
                                <a
                                  href={`/payroll/payslips/${run.id}/${r.item.employeeId}`}
                                  className="hover:underline"
                                >
                                  <span className="block font-medium">
                                    {r.lastName}, {r.firstName}
                                  </span>
                                  <span className="block text-xs text-muted-foreground">
                                    {r.employeeNo}
                                  </span>
                                </a>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {r.item.daysWorked}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {r.item.daysAbsent}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {otHours > 0 ? otHours.toFixed(2) : "—"}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {r.item.hoursNsd > 0 ? r.item.hoursNsd.toFixed(2) : "—"}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatPhp(r.item.grossPay)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatPhp(r.item.totalDeductions)}
                              </TableCell>
                              <TableCell className="text-right font-medium tabular-nums">
                                {formatPhp(r.item.netPay)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                      <TableFooter>
                        <TableRow>
                          <TableCell colSpan={5}>Run totals</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {run.grossTotal != null ? formatPhp(run.grossTotal) : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {run.deductionTotal != null ? formatPhp(run.deductionTotal) : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {run.netTotal != null ? formatPhp(run.netTotal) : "—"}
                          </TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>

                    {pages > 1 ? (
                      <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
                        <span className="text-muted-foreground">
                          Page {page} of {pages} · {totalItems} employees
                        </span>
                        <div className="flex gap-2">
                          {page > 1 ? (
                            <Button asChild variant="outline" size="sm">
                              <a href={registerHref(page - 1)}>Previous</a>
                            </Button>
                          ) : null}
                          {page < pages ? (
                            <Button asChild variant="outline" size="sm">
                              <a href={registerHref(page + 1)}>Next</a>
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </PageBody>
    </>
  );
}
