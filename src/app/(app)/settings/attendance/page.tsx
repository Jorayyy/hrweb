import { requireRole } from "@/lib/auth";
import { getAttendanceRules } from "@/lib/settings";
import { PageBody, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { saveSettings } from "../actions";
import { SettingsForm } from "../form";

const OT_STEPS = [0, 5, 10, 15, 30, 60];

export default async function AttendanceSettingsPage() {
  await requireRole("ADMIN");
  const rules = await getAttendanceRules();

  return (
    <>
      <PageHeader
        back
        title="Attendance rules"
        description="Grace period and overtime rounding applied when DTR days are computed"
      />
      <PageBody>
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Late & overtime</CardTitle>
            <CardDescription>
              Applies to punches recorded from now on, and to any day re-saved afterwards.
              Existing attendance rows keep their recorded values.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SettingsForm
              action={saveSettings.bind(null, "attendance")}
              fields={[
                {
                  name: "lateGraceMinutes",
                  label: "Late grace (minutes)",
                  kind: "number",
                  value: rules.graceSeconds / 60,
                  min: 0,
                  max: 60,
                  hint: "The first minutes of lateness are absorbed. 8 min late with a 5 min grace counts as 3 min late.",
                },
                {
                  name: "otRoundMinutes",
                  label: "Overtime rounding (minutes)",
                  kind: "select",
                  value: String(rules.otRoundSeconds / 60),
                  options: OT_STEPS.map((m) => ({
                    value: String(m),
                    label: m === 0 ? "Off — exact seconds" : `Floor to ${m} min`,
                  })),
                  hint: "Overtime is rounded down to this increment before it is paid.",
                },
              ]}
            />
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
