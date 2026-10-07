import { requireRole } from "@/lib/auth";
import { PAY_FREQUENCIES, getPayrollSettings } from "@/lib/settings";
import { PageBody, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { saveSettings } from "../actions";
import { SettingsForm } from "../form";

export default async function PayrollSettingsPage() {
  await requireRole("ADMIN");
  const payroll = await getPayrollSettings();

  return (
    <>
      <PageHeader back title="Payroll" description="Defaults for cutoffs and payslips" />
      <PageBody>
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Payroll defaults</CardTitle>
            <CardDescription>
              Used when opening a new cutoff and printed on every payslip.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SettingsForm
              action={saveSettings.bind(null, "payroll")}
              fields={[
                {
                  name: "defaultPayFrequency",
                  label: "Default cutoff frequency",
                  kind: "select",
                  value: payroll.defaultPayFrequency,
                  options: PAY_FREQUENCIES.map((f) => ({
                    value: f,
                    label: f.replace("_", " ").toLowerCase(),
                  })),
                },
                {
                  name: "payslipFooterNote",
                  label: "Payslip footer note",
                  kind: "textarea",
                  value: payroll.payslipFooterNote,
                  maxLength: 300,
                  hint: "Shown under every payslip — bank details, cut-off reminders, claim instructions.",
                },
              ]}
            />
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
