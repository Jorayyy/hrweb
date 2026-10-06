import { requireRole } from "@/lib/auth";
import { getCompany } from "@/lib/settings";
import { PageBody, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanyForm } from "./form";

export default async function SettingsPage() {
  await requireRole("ADMIN");
  const company = await getCompany();

  return (
    <>
      <PageHeader back title="Settings" description="Company branding shown across the app" />
      <PageBody>
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Company</CardTitle>
            <CardDescription>
              Shown in the sidebar, login page, time clock and browser tab.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CompanyForm name={company.name} logo={company.logo} />
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
