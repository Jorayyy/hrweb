import { requireRole } from "@/lib/auth";
import { getSecuritySettings } from "@/lib/settings";
import { PageBody, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { saveSettings } from "../actions";
import { ChangePasswordForm, SettingsForm } from "../form";

export default async function SecuritySettingsPage() {
  await requireRole("ADMIN");
  const security = await getSecuritySettings();

  return (
    <>
      <PageHeader
        back
        title="Security"
        description="Password policy, session timeout and lockouts"
      />
      <PageBody>
        <div className="grid max-w-4xl gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Policies</CardTitle>
              <CardDescription>
                A session expires this many days after sign-in. Lockouts trigger after the set
                number of failed attempts, whether from the login page or the kiosk.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SettingsForm
                action={saveSettings.bind(null, "security")}
                fields={[
                  {
                    name: "passwordMinLength",
                    label: "Minimum password length",
                    kind: "number",
                    value: security.passwordMinLength,
                    min: 6,
                    max: 128,
                  },
                  {
                    name: "sessionTimeoutDays",
                    label: "Session timeout (days)",
                    kind: "number",
                    value: security.sessionTimeoutDays,
                    min: 1,
                    max: 365,
                  },
                  {
                    name: "loginLockoutAttempts",
                    label: "Login attempts before lockout",
                    kind: "number",
                    value: security.loginLockoutAttempts,
                    min: 3,
                    max: 100,
                  },
                  {
                    name: "loginLockoutMinutes",
                    label: "Login lockout (minutes)",
                    kind: "number",
                    value: security.loginLockoutMinutes,
                    min: 1,
                    max: 1440,
                  },
                  {
                    name: "kioskLockoutAttempts",
                    label: "Kiosk PIN attempts before lockout",
                    kind: "number",
                    value: security.kioskLockoutAttempts,
                    min: 3,
                    max: 100,
                  },
                  {
                    name: "kioskLockoutMinutes",
                    label: "Kiosk lockout (minutes)",
                    kind: "number",
                    value: security.kioskLockoutMinutes,
                    min: 1,
                    max: 1440,
                  },
                ]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your password</CardTitle>
              <CardDescription>Change the password for your own account.</CardDescription>
            </CardHeader>
            <CardContent>
              <ChangePasswordForm minLength={security.passwordMinLength} />
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
