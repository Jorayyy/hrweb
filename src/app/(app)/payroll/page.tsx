import { requireRole } from "@/lib/auth";
import { PageBody, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PayrollPage() {
  await requireRole("ADMIN", "PAYROLL");

  return (
    <>
      <PageHeader
        title="Payroll"
        description="Periods, cutoff runs, registers and payslips"
      />
      <PageBody>
        <Card className="mx-auto max-w-2xl border-dashed">
          <CardHeader>
            <CardTitle>The engine is ready — the run screen comes next</CardTitle>
            <CardDescription>
              Statutory tables (SSS, PhilHealth, Pag-IBIG, BIR TRAIN) are seeded and covered by tests.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Expected here: cutoff selection, gross-to-net computation, contribution reports, and
            payslip export.
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
