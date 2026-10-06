import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { campaign, employee, jobPosition, payrollPeriod, payrollRun, payrollRunItem } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/money";
import { PageBody, PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { PayslipView, type PayslipPerson } from "@/components/payslip-view";

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
  const backHref = `/payroll/periods/${run.periodId}?run=${run.id}`;

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
        <PayslipView item={item} run={run} person={person} />
      </PageBody>
    </>
  );
}
