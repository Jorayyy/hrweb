import { requireRole } from "@/lib/auth";
import { DATE_STYLES, getLocaleSettings } from "@/lib/settings";
import { PageBody, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { saveSettings } from "../actions";
import { SettingsForm } from "../form";

const CURRENCIES = ["PHP", "USD", "EUR", "GBP", "JPY", "CNY", "INR", "AUD", "CAD", "SGD", "AED"];

const DATE_LABELS: Record<string, string> = {
  full: "Sunday, January 31, 2026",
  long: "January 31, 2026",
  medium: "Jan 31, 2026",
  short: "1/31/26",
};

const opt = (value: string, label: string) => ({ value, label });

export default async function LocaleSettingsPage() {
  await requireRole("ADMIN");
  const locale = await getLocaleSettings();

  return (
    <>
      <PageHeader
        back
        title="Locale & formats"
        description="How money and dates are displayed across the app"
      />
      <PageBody>
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Display formats</CardTitle>
            <CardDescription>
              Presentation only — amounts are always stored as exact centavos and dates as ISO.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SettingsForm
              action={saveSettings.bind(null, "locale")}
              fields={[
                {
                  name: "currency",
                  label: "Currency",
                  kind: "select",
                  value: locale.currency,
                  options: CURRENCIES.map((c) => opt(c, c)),
                },
                {
                  name: "dateStyle",
                  label: "Date format",
                  kind: "select",
                  value: locale.dateStyle,
                  options: DATE_STYLES.map((d) => opt(d, DATE_LABELS[d])),
                },
                {
                  name: "grouping",
                  label: "Number format",
                  kind: "select",
                  value: String(locale.grouping),
                  options: [
                    opt("true", "1,234,567.89 (grouped)"),
                    opt("false", "1234567.89 (plain)"),
                  ],
                },
              ]}
            />
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
