import { db } from "@/db";
import { bundyIp } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { PageBody, PageHeader } from "@/components/page-header";
import { ReferenceForm } from "@/components/reference-form";
import { Button } from "@/components/ui/button";
import { addBundyIp, removeBundyIp } from "../actions";
import { Section } from "../section";

export default async function TimeClockIpsPage() {
  await requireRole("ADMIN", "HR");
  const bundyIps = await db.select().from(bundyIp).orderBy(bundyIp.ip);

  return (
    <>
      <PageHeader
        back
        title="Time clock IPs"
        description="Only these IPs can record punches on the web bundy kiosk."
      />

      <PageBody>
        <Section
          title="Time clock IPs"
          description="Only these IPs can record punches on the web bundy kiosk."
          columns={["IP address", "Label", ""]}
          empty="No IPs registered — the kiosk rejects every punch until at least one IP is added."
          rows={bundyIps.map((b) => ({
            key: b.id,
            cells: [
              <span key="ip" className="tabular-nums">{b.ip}</span>,
              b.label,
              <form key="remove" action={removeBundyIp.bind(null, b.id)} className="text-right">
                <Button type="submit" variant="ghost" size="sm" className="text-destructive">
                  Remove
                </Button>
              </form>,
            ],
          }))}
        >
          <ReferenceForm
            action={addBundyIp}
            fields={[
              { name: "ip", label: "IP address", required: true, placeholder: "112.198.100.7" },
              { name: "label", label: "Label", required: true, placeholder: "Office main" },
            ]}
            submitLabel="Register IP"
          />
        </Section>
      </PageBody>
    </>
  );
}
