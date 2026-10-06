import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { ChevronRight } from "lucide-react";
import { db } from "@/db";
import { payrollPeriod, payrollRun, payrollRunItem } from "@/db/schema";
import { selfEmployee } from "@/lib/auth";
import { formatDate, formatPhp } from "@/lib/money";
import { PageBody, PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PeriodSelect } from "./period-select";

export default async function PayslipsPage({
  searchParams,
}: {
  searchParams?: Promise<{ period?: string }>;
}) {
  const { user, employeeId } = await selfEmployee();

  if (!employeeId) {
    return (
      <>
        <PageHeader title="My Payslips" description={`Signed in as ${user.role}`} />
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

  const params = (await searchParams) ?? {};
  const period = params.period ?? "";

  const all = await db
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
    .orderBy(desc(payrollPeriod.payDate), desc(payrollRun.runNo));

  const rows = period ? all.filter((r) => String(r.runId) === period) : all;
  const options = all.map((r) => ({
    runId: String(r.runId),
    label: `${r.periodCode} · ${formatDate(r.payDate)}`,
  }));

  return (
    <>
      <PageHeader
        title="My Payslips"
        description={`${rows.length} payslip${rows.length === 1 ? "" : "s"} · posted runs only`}
      >
        <PeriodSelect options={options} />
      </PageHeader>
      <PageBody>
        <Card>
          <CardContent className="pt-6">
            {rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {period
                  ? "No payslip for this period."
                  : "No payslips yet — they appear here once payroll is posted."}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Pay date</TableHead>
                    <TableHead className="text-right">Net pay</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.runId}>
                      <TableCell className="font-medium">{r.periodCode}</TableCell>
                      <TableCell className="tabular-nums">{formatDate(r.payDate)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatPhp(r.netPay)}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/payslips/${r.runId}`}
                          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                        >
                          View <ChevronRight className="size-4" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
