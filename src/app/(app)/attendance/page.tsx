import { requireRole } from "@/lib/auth";
import { PageBody, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AttendancePage() {
  await requireRole("ADMIN", "HR");

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Biometric punches, shift matching and day assembly"
      />
      <PageBody>
        <Card className="mx-auto max-w-2xl border-dashed">
          <CardHeader>
            <CardTitle>Not built yet</CardTitle>
            <CardDescription>
              CSV import and punch matching land next. Until then, review the source data in Setup.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Expected here: daily totals, exceptions (absent / late / undertime), rest-day and night
            differential hours.
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
