import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { campaign, employee, jobPosition, payrollPeriod, payrollRun, payrollRunItem } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { formatDate, formatPhp } from "@/lib/money";
import { PageBody, PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const Row = ({ label, value, muted }: { label: string; value: string; muted?: boolean }) => (
  <TableRow>
    <TableCell className={muted ? "text-muted-foreground" : undefined}>{label}</TableCell>
    <TableCell className="text-right tabular-nums">{value}</TableCell>
  </TableRow>
);

export default async function PayslipPage({
  params,
}: {
  params: Promise<{ runId: string; employeeId: string }>;
}) {
  await requireRole("ADMIN", "PAYROLL");
  const { runId, employeeId } = await params;

  const [row] = await db
    .select({
      item: payrollRunItem,
      run: payrollRun,
      period: payrollPeriod,
      firstName: employee.firstName,
      lastName: employee.lastName,
      middleName: employee.middleName,
      employeeNo: employee.employeeNo,
      payFrequency: employee.payFrequency,
      baseSalaryMonthly: employee.baseSalaryMonthly,
      tinNo: employee.tinNo,
      sssNo: employee.sssNo,
      philhealthNo: employee.philhealthNo,
      pagibigNo: employee.pagibigNo,
      positionTitle: jobPosition.title,
      campaignName: campaign.name,
    })
    .from(payrollRunItem)
    .innerJoin(payrollRun, eq(payrollRunItem.runId, payrollRun.id))
    .innerJoin(payrollPeriod, eq(payrollRun.periodId, payrollPeriod.id))
    .innerJoin(employee, eq(payrollRunItem.employeeId, employee.id))
    .innerJoin(jobPosition, eq(employee.positionId, jobPosition.id))
    .innerJoin(campaign, eq(employee.campaignId, campaign.id))
    .where(
      and(eq(payrollRunItem.runId, Number(runId)), eq(payrollRunItem.employeeId, Number(employeeId))),
    )
    .limit(1);

  if (!row) notFound();

  const { item, run, period } = row;
  const otHours =
    item.hoursOtOrd + item.hoursOtRd + item.hoursOtSpecl + item.hoursOtRh + item.hoursOtRhRd;
  const employerTotal =
    item.sssEr + item.sssWispEr + item.phicEr + item.hdmfEr;
  const backHref = `/payroll?period=${run.periodId}&run=${run.id}`;

  return (
    <>
      <PageHeader
        title={`Payslip — ${row.lastName}, ${row.firstName}`}
        description={`${period.periodCode} · run #${run.runNo} · pay date ${formatDate(period.payDate)}`}
      >
        <a href={backHref} className="text-sm text-muted-foreground hover:underline">
          ← Back to register
        </a>
        <StatusBadge status={run.status} />
      </PageHeader>

      <PageBody>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Employee</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <div className="grid grid-cols-2 gap-y-2">
                <span className="text-muted-foreground">Employee no.</span>
                <span className="text-right">{row.employeeNo}</span>
                <span className="text-muted-foreground">Name</span>
                <span className="text-right">
                  {row.lastName}, {row.firstName} {row.middleName ?? ""}
                </span>
                <span className="text-muted-foreground">Position</span>
                <span className="text-right">{row.positionTitle}</span>
                <span className="text-muted-foreground">Campaign</span>
                <span className="text-right">{row.campaignName}</span>
                <span className="text-muted-foreground">Pay frequency</span>
                <span className="text-right">{row.payFrequency}</span>
                <span className="text-muted-foreground">Monthly basic</span>
                <span className="text-right tabular-nums">
                  {formatPhp(row.baseSalaryMonthly)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Statutory numbers</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <div className="grid grid-cols-2 gap-y-2">
                <span className="text-muted-foreground">SSS</span>
                <span className="text-right tabular-nums">{row.sssNo ?? "—"}</span>
                <span className="text-muted-foreground">PhilHealth</span>
                <span className="text-right tabular-nums">{row.philhealthNo ?? "—"}</span>
                <span className="text-muted-foreground">Pag-IBIG</span>
                <span className="text-right tabular-nums">{row.pagibigNo ?? "—"}</span>
                <span className="text-muted-foreground">TIN</span>
                <span className="text-right tabular-nums">{row.tinNo ?? "—"}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Earnings</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Line</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <Row label="Basic pay" value={formatPhp(item.basicPay)} />
                  <Row label="Holiday pay" value={formatPhp(item.holidayPay)} />
                  <Row label="Rest-day pay" value={formatPhp(item.restDayPay)} />
                  <Row
                    label={`Overtime (${otHours.toFixed(2)} h)`}
                    value={formatPhp(item.otPay)}
                  />
                  <Row
                    label={`Night differential (${item.hoursNsd.toFixed(2)} h)`}
                    value={formatPhp(item.nsdPay)}
                  />
                  <Row label="Allowances / other" value={formatPhp(item.otherEarnings)} />
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell>Gross pay</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPhp(item.grossPay)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Deductions</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Line</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <Row label="SSS (EE)" value={formatPhp(item.sssEe)} />
                  <Row label="SSS WISP (EE)" value={formatPhp(item.sssWispEe)} />
                  <Row label="PhilHealth (EE)" value={formatPhp(item.phicEe)} />
                  <Row label="Pag-IBIG (EE)" value={formatPhp(item.hdmfEe)} />
                  <Row label="Withholding tax" value={formatPhp(item.birTax)} />
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell>Total deductions</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPhp(item.totalDeductions)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="mt-4 flex flex-col items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-4 sm:flex-row">
          <span className="text-sm font-medium">Net pay</span>
          <span className="text-2xl font-semibold tabular-nums">{formatPhp(item.netPay)}</span>
        </div>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Employer contributions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <Row label="SSS (ER)" value={formatPhp(item.sssEr)} muted />
                <Row label="SSS WISP (ER)" value={formatPhp(item.sssWispEr)} muted />
                <Row label="PhilHealth (ER)" value={formatPhp(item.phicEr)} muted />
                <Row label="Pag-IBIG (ER)" value={formatPhp(item.hdmfEr)} muted />
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Total employer</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPhp(employerTotal)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Engine {item.calcEngineVer} · {item.calcAt.toISOString().slice(0, 16).replace("T", " ")}{" "}
          UTC · payrule {run.payruleVersion} · taxable pay {formatPhp(item.taxablePay)}
        </p>
      </PageBody>
    </>
  );
}
