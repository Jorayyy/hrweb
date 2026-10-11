import Link from "next/link";
import { desc, inArray } from "drizzle-orm";
import { ChevronRight, Plus } from "lucide-react";
import { db } from "@/db";
import { payrollPeriod, payrollRun } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { formatDate, formatPhp } from "@/lib/money";
import { getPayrollSettings } from "@/lib/settings";
import { PageBody, PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CreatePayroll } from "./create-payroll";
import { createPeriod, createRun, openPeriod } from "./actions";

type Period = typeof payrollPeriod.$inferSelect;
type RunStat = { n: number; latest: { status: string; headcount: number | null; netTotal: number | null } };

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
          .select({
            id: payrollRun.id,
            periodId: payrollRun.periodId,
            status: payrollRun.status,
            headcount: payrollRun.headcount,
            netTotal: payrollRun.netTotal,
          })
          .from(payrollRun)
          .where(inArray(payrollRun.periodId, periods.map((p) => p.id)))
          .orderBy(desc(payrollRun.runNo))
      : [];
  const byPeriod = new Map<number, RunStat>();
  for (const r of runs) {
    const existing = byPeriod.get(r.periodId);
    if (existing) existing.n += 1;
    else byPeriod.set(r.periodId, { n: 1, latest: r });
  }

  const columns: { title: string; items: Period[] }[] = [
    { title: "In progress", items: [] },
    { title: "Posted", items: [] },
    { title: "Void", items: [] },
  ];
  for (const p of periods) {
    const latest = byPeriod.get(p.id)?.latest;
    if (latest?.status === "POSTED") columns[1].items.push(p);
    else if (latest?.status === "VOID") columns[2].items.push(p);
    else columns[0].items.push(p);
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

        <p className="mb-4 text-xs text-muted-foreground">
          Semi-monthly: 1–15th (pay 25th) and 16–last day (pay 10th). Weekly: Mon–Sun, paid 7 days
          after cutoff.
        </p>

        <div className="grid gap-4 lg:grid-cols-3">
          {columns.map((col) => (
            <Card key={col.title}>
              <CardContent className="grid gap-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">{col.title}</h2>
                  <Badge variant="secondary">{col.items.length}</Badge>
                </div>
                {col.items.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-3 py-6 text-center">
                    <CreatePayroll
                      open={openPeriod}
                      custom={createPeriod}
                      defaultFreq={defaultPayFrequency}
                      trigger={
                        <Button variant="outline" size="sm">
                          <Plus />
                          Create period
                        </Button>
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      No periods in this column yet
                    </p>
                  </div>
                ) : (
                  col.items.map((p) => {
                    const stat = byPeriod.get(p.id);
                    return (
                      <div
                        key={p.id}
                        className="grid gap-2 rounded-lg border p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link
                              href={`/payroll/periods/${p.id}`}
                              className="font-medium hover:underline"
                            >
                              {p.periodCode}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(p.dateFrom)} – {formatDate(p.dateTo)}
                            </p>
                          </div>
                          {stat ? (
                            <StatusBadge status={stat.latest.status} />
                          ) : (
                            <Badge variant="outline">No runs</Badge>
                          )}
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-xs text-muted-foreground">
                            Pay {formatDate(p.payDate)}
                          </span>
                          <span className="font-medium tabular-nums">
                            {stat?.latest.netTotal != null ? formatPhp(stat.latest.netTotal) : "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 border-t pt-2">
                          <span className="text-xs text-muted-foreground">
                            {stat?.latest.headcount ?? "—"} employees · {stat?.n ?? 0} run
                            {stat?.n === 1 ? "" : "s"}
                          </span>
                          <div className="flex gap-1">
                            <form action={createRun.bind(null, p.id)} className="inline">
                              <SubmitButton variant="outline" size="xs">
                                New run
                              </SubmitButton>
                            </form>
                            <Button asChild variant="ghost" size="xs">
                              <Link href={`/payroll/periods/${p.id}`}>
                                Open
                                <ChevronRight />
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </PageBody>
    </>
  );
}
