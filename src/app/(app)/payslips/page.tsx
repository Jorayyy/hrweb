import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { ChevronRight } from "lucide-react";
import { db } from "@/db";
import { payrollPeriod, payrollRun, payrollRunItem } from "@/db/schema";
import { selfEmployee } from "@/lib/auth";
import { formatDate, formatPhp } from "@/lib/money";
import { PageBody, PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function PayslipsPage() {
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

  const rows = await db
    .select({
      runId: payrollRun.id,
      status: payrollRun.status,
      runNo: payrollRun.runNo,
      periodCode: payrollPeriod.periodCode,
      dateFrom: payrollPeriod.dateFrom,
      dateTo: payrollPeriod.dateTo,
      payDate: payrollPeriod.payDate,
      grossPay: payrollRunItem.grossPay,
      totalDeductions: payrollRunItem.totalDeductions,
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

  return (
    <>
      <PageHeader
        title="My Payslips"
        description={`${rows.length} payslip${rows.length === 1 ? "" : "s"} · posted runs only`}
      />
      <PageBody>
        <Card>
          <CardContent className="pt-6">
            {rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No payslips yet — they appear here once payroll is posted.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pay date</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Cutoff</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right">Net pay</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.runId}>
                      <TableCell className="tabular-nums">{formatDate(r.payDate)}</TableCell>
                      <TableCell className="font-medium">{r.periodCode}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {formatDate(r.dateFrom)} – {formatDate(r.dateTo)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatPhp(r.grossPay)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPhp(r.totalDeductions)}
                      </TableCell>
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
