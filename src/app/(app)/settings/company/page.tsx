import { requireRole } from "@/lib/auth";
import { getCompany } from "@/lib/settings";
import { PageBody, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanyForm } from "../form";

export default async function CompanySettingsPage() {
  await requireRole("ADMIN");
  const company = await getCompany();

  return (
    <>
      <PageHeader
        back
        title="Company"
        description="Identity and contact details shown across the app and on payslips"
      />
      <PageBody>
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Company</CardTitle>
            <CardDescription>
              Shown in the sidebar, login page, time clock, browser tab and payslips.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CompanyForm
              name={company.name}
              logo={company.logo}
              contact={{
                companyAddress: company.address,
                companyTin: company.tin,
                companyDoleRegNo: company.doleRegNo,
                companyPhone: company.phone,
                companyEmail: company.email,
              }}
            />
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
