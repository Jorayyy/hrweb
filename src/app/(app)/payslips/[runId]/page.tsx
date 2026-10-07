import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { campaign, employee, jobPosition, payrollPeriod, payrollRun, payrollRunItem } from "@/db/schema";
import { selfEmployee } from "@/lib/auth";
import { formatDate } from "@/lib/money";
import { getCompany, getPayrollSettings } from "@/lib/settings";
import { PageBody, PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { PayslipView, type PayslipPerson } from "@/components/payslip-view";

export default async function PayslipDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { employeeId } = await selfEmployee();
  if (!employeeId) notFound();
  const [company, payroll] = await Promise.all([getCompany(), getPayrollSettings()]);

  const { runId: rawRunId } = await params;
  const runId = Number(rawRunId);
  if (!Number.isInteger(runId)) notFound();

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
      and(
        eq(payrollRunItem.runId, runId),
        eq(payrollRunItem.employeeId, employeeId),
        eq(payrollRun.status, "POSTED"),
      ),
    )
    .limit(1);

  if (!row) notFound();

  const { item, run, period } = row;
  const person: PayslipPerson = {
    employeeNo: row.employeeNo,
    firstName: row.firstName,
    lastName: row.lastName,
    middleName: row.middleName,
    positionTitle: row.positionTitle,
    campaignName: row.campaignName,
    payFrequency: row.payFrequency,
    baseSalaryMonthly: row.baseSalaryMonthly,
    tinNo: row.tinNo,
    sssNo: row.sssNo,
    philhealthNo: row.philhealthNo,
    pagibigNo: row.pagibigNo,
  };

  return (
    <>
      <PageHeader
        title={`Payslip — ${row.lastName}, ${row.firstName}`}
        description={`${period.periodCode} · run #${run.runNo} · pay date ${formatDate(period.payDate)}`}
      >
        <Link href="/payslips" className="text-sm text-muted-foreground hover:underline">
          ← Back to payslips
        </Link>
        <StatusBadge status={run.status} />
      </PageHeader>

      <PageBody>
        <PayslipView
          item={item}
          run={run}
          person={person}
          company={company}
          note={payroll.payslipFooterNote || undefined}
        />
      </PageBody>
    </>
  );
}
