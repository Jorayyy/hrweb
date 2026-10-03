import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { EmployeeForm } from "@/components/employee-form";
import { PageBody, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createEmployee } from "../actions";
import { ENUM_OPTIONS, employeeSelects } from "../queries";

export default async function NewEmployeePage() {
  await requireRole("ADMIN", "HR");

  const selects = await employeeSelects();
  const missing = [
    selects.costCenters.length === 0 && "cost centers",
    selects.campaigns.length === 0 && "campaigns",
    selects.departments.length === 0 && "departments",
    selects.positions.length === 0 && "job positions",
  ].filter(Boolean) as string[];

  if (missing.length > 0) {
    return (
      <>
        <PageHeader title="Add employee" />
        <PageBody>
          <Card className="mx-auto max-w-2xl border-dashed">
            <CardHeader>
              <CardTitle>Set up the organization first</CardTitle>
              <CardDescription>
                Create these before adding employees:{" "}
                <span className="font-medium text-foreground">{missing.join(", ")}.</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/setup">Go to setup</Link>
              </Button>
            </CardContent>
          </Card>
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Add employee" description="Daily rate = monthly ÷ 22, hourly = daily ÷ 8." />
      <PageBody>
        <div className="mx-auto max-w-4xl">
          <Card>
            <CardContent className="pt-6">
              <EmployeeForm
                action={createEmployee}
                selects={selects}
                enums={ENUM_OPTIONS}
                submitLabel="Create employee"
              />
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
