import Link from "next/link";
import { desc, inArray } from "drizzle-orm";
import { ChevronRight } from "lucide-react";
import { db } from "@/db";
import { payrollPeriod, payrollRun } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/money";
import { getPayrollSettings } from "@/lib/settings";
import { PageBody, PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreatePayroll } from "./create-payroll";
import { createPeriod, createRun, openPeriod } from "./actions";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  await requireRole("ADMIN", "PAYROLL");

  const params = (await searchParams) ?? {};
  const error = (params.error ?? "").trim();
  const { defaultPayFrequency } = await getPayrollSettings();

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
        <CreatePayroll open={openPeriod} custom={createPeriod} defaultFreq={defaultPayFrequency} />
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
                  No payrolls yet — create one to begin.
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
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
