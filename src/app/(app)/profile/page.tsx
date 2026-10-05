import { eq } from "drizzle-orm";
import { db } from "@/db";
import { campaign, costCenter, department, employee, jobPosition } from "@/db/schema";
import { selfEmployee } from "@/lib/auth";
import { formatDate, formatPhp } from "@/lib/money";
import { PageBody, PageHeader } from "@/components/page-header";
import { StatusBadge, humanize } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Field({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </>
  );
}

export default async function ProfilePage() {
  const { user, employeeId } = await selfEmployee();

  if (!employeeId) {
    return (
      <>
        <PageHeader title="My Profile" description={`Signed in as ${user.role}`} />
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

  const [row] = await db
    .select({
      emp: employee,
      positionTitle: jobPosition.title,
      departmentName: department.name,
      campaignName: campaign.name,
      campaignClient: campaign.clientName,
      costCenterName: costCenter.name,
    })
    .from(employee)
    .innerJoin(jobPosition, eq(employee.positionId, jobPosition.id))
    .innerJoin(department, eq(employee.departmentId, department.id))
    .innerJoin(campaign, eq(employee.campaignId, campaign.id))
    .innerJoin(costCenter, eq(employee.costCenterId, costCenter.id))
    .where(eq(employee.id, employeeId))
    .limit(1);

  if (!row) {
    return (
      <>
        <PageHeader title="My Profile" />
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

  const { emp } = row;
  const [manager] = emp.reportsToId
    ? await db
        .select({ name: employee.firstName, lastName: employee.lastName })
        .from(employee)
        .where(eq(employee.id, emp.reportsToId))
        .limit(1)
    : [];

  const fullName = `${emp.lastName}, ${emp.firstName} ${emp.middleName ?? ""}`.trim();
  const restDays = emp.weeklyRestDays.length
    ? [...emp.weeklyRestDays]
        .sort((a, b) => a - b)
        .map((d) => DAY_NAMES[d] ?? String(d))
        .join(", ")
    : "—";

  return (
    <>
      <PageHeader title="My Profile" description={`${emp.employeeNo} · view only — changes go through HR`}>
        <StatusBadge status={emp.status} />
      </PageHeader>

      <PageBody>
        <div className="mx-auto grid max-w-4xl gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Personal</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-y-2 text-sm">
              <Field label="Employee no." value={emp.employeeNo} />
              <Field label="Name" value={fullName} />
              <Field label="Email" value={emp.email ?? "—"} />
              <Field label="Biometric code" value={emp.externalCode} />
              <Field label="Date hired" value={formatDate(emp.dateHired)} />
              <Field
                label="Date regularized"
                value={emp.dateRegularized ? formatDate(emp.dateRegularized) : "—"}
              />
              <Field label="Status" value={humanize(emp.status)} />
              <Field label="Employment type" value={humanize(emp.employmentType)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Job</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-y-2 text-sm">
              <Field label="Position" value={row.positionTitle} />
              <Field label="Department" value={row.departmentName} />
              <Field label="Campaign" value={row.campaignName} />
              <Field label="Client" value={row.campaignClient} />
              <Field label="Cost center" value={row.costCenterName} />
              <Field
                label="Reports to"
                value={manager ? `${manager.lastName}, ${manager.name}` : "—"}
              />
              <Field label="Weekly rest days" value={restDays} />
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Pay & statutory</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-y-2 text-sm sm:grid-cols-3">
              <Field label="Pay frequency" value={humanize(emp.payFrequency)} />
              <Field label="Monthly basic" value={formatPhp(emp.baseSalaryMonthly)} />
              <Field label="TIN" value={emp.tinNo ?? "—"} />
              <Field label="SSS" value={emp.sssNo ?? "—"} />
              <Field label="PhilHealth" value={emp.philhealthNo ?? "—"} />
              <Field label="Pag-IBIG" value={emp.pagibigNo ?? "—"} />
              <Field label="RDO" value={emp.rdoCode ?? "—"} />
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
