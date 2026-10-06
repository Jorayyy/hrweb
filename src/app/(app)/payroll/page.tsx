import Link from "next/link";
import { desc, inArray } from "drizzle-orm";
import { ChevronRight } from "lucide-react";
import { db } from "@/db";
import { payrollPeriod, payrollRun } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/money";
import { PageBody, PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, selectCx } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createPeriod, createRun, openPeriod } from "./actions";

const FREQS = ["SEMI_MONTHLY", "MONTHLY", "WEEKLY", "DAILY"] as const;

export default async function PayrollPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  await requireRole("ADMIN", "PAYROLL");

  const params = (await searchParams) ?? {};
  const error = (params.error ?? "").trim();

  const periods = await db
    .select()
    .from(payrollPeriod)
    .orderBy(desc(payrollPeriod.dateFrom))
    .limit(50);

  const runs =
    periods.length > 0
      ? await db
          .select({ id: payrollRun.id, periodId: payrollRun.periodId, status: payrollRun.status })
          .from(payrollRun)
          .where(inArray(payrollRun.periodId, periods.map((p) => p.id)))
          .orderBy(desc(payrollRun.runNo))
      : [];
  const byPeriod = new Map<number, { n: number; latest: (typeof runs)[number] }>();
  for (const r of runs) {
    const existing = byPeriod.get(r.periodId);
    if (existing) existing.n += 1;
    else byPeriod.set(r.periodId, { n: 1, latest: r });
  }

  return (
    <>
      <PageHeader title="Payroll" description="Cutoff periods, runs and registers">
        <form action={openPeriod} className="flex items-center gap-2">
          <select name="frequency" defaultValue="SEMI_MONTHLY" className={`${selectCx} h-8 w-40`}>
            <option value="SEMI_MONTHLY">Semi-monthly</option>
            <option value="WEEKLY">Weekly</option>
          </select>
          <SubmitButton size="sm">
            Open cutoff
          </SubmitButton>
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
                7 days after cutoff. Open a period to see its runs, register and pre-post checks.
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
                      <TableHead>Latest run</TableHead>
                      <TableHead className="text-right">Runs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {periods.map((p) => {
                      const stat = byPeriod.get(p.id);
                      return (
                        <TableRow key={p.id}>
                          <TableCell>
                            <Link
                              href={`/payroll/periods/${p.id}`}
                              className="font-medium hover:underline"
                            >
                              {p.periodCode}
                            </Link>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(p.dateFrom)} – {formatDate(p.dateTo)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(p.payDate)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{p.frequency}</TableCell>
                          <TableCell>
                            {stat ? (
                              <StatusBadge status={stat.latest.status} />
                            ) : (
                              <span className="text-muted-foreground">No runs</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center justify-end gap-2">
                              <span className="tabular-nums text-muted-foreground">
                                {stat?.n ?? 0}
                              </span>
                              <form action={createRun.bind(null, p.id)} className="inline">
                                <SubmitButton variant="outline" size="sm">
                                  New run
                                </SubmitButton>
                              </form>
                              <Button asChild variant="ghost" size="sm">
                                <Link href={`/payroll/periods/${p.id}`}>
                                  Open
                                  <ChevronRight className="size-3.5" />
                                </Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}

              <details className="group mt-4 rounded-lg border border-border">
                <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
                  <span>Open a custom period</span>
                  <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
                </summary>
                <form
                  action={createPeriod}
                  className="grid gap-3 border-t border-border p-4 sm:grid-cols-2 lg:grid-cols-6"
                >
                  <Field label="Period code" name="periodCode" className="lg:col-span-1">
                    <Input id="periodCode" name="periodCode" placeholder="2026-09-C" required />
                  </Field>
                  <Field label="Date from" name="dateFrom">
                    <Input id="dateFrom" name="dateFrom" type="date" required />
                  </Field>
                  <Field label="Date to" name="dateTo">
                    <Input id="dateTo" name="dateTo" type="date" required />
                  </Field>
                  <Field label="Pay date" name="payDate">
                    <Input id="payDate" name="payDate" type="date" required />
                  </Field>
                  <Field label="Frequency" name="frequency">
                    <select id="frequency" name="frequency" defaultValue="SEMI_MONTHLY" className={selectCx}>
                      {FREQS.map((f) => (
                        <option key={f} value={f}>
                          {f.replace("_", " ").toLowerCase()}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="flex items-end">
                    <SubmitButton size="sm" className="w-full">
                      Create period
                    </SubmitButton>
                  </div>
                </form>
              </details>
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
