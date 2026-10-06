import { db } from "@/db";
import { campaign, costCenter } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { PageBody, PageHeader } from "@/components/page-header";
import { ReferenceForm } from "@/components/reference-form";
import { addCampaign } from "../actions";
import { Section } from "../section";

export default async function CampaignsPage() {
  await requireRole("ADMIN", "HR");
  const [campaigns, costCenters] = await Promise.all([
    db.select().from(campaign).orderBy(campaign.code),
    db.select().from(costCenter).orderBy(costCenter.code),
  ]);

  const costCenterOptions = costCenters.map((c) => ({
    value: String(c.id),
    label: `${c.code} — ${c.name}`,
  }));

  return (
    <>
      <PageHeader
        back
        title="Campaigns"
        description="Client accounts that employees are assigned to."
      />

      <PageBody>
        <Section
          title="Campaigns"
          description="Client accounts that employees are assigned to."
          columns={["Code", "Name", "Client", "Cost center"]}
          empty="No campaigns yet."
          rows={campaigns.map((c) => ({
            key: c.id,
            cells: [
              c.code,
              c.name,
              c.clientName,
              costCenters.find((x) => x.id === c.costCenterId)?.code ?? "—",
            ],
          }))}
        >
          <ReferenceForm
            action={addCampaign}
            fields={[
              { name: "code", label: "Code", required: true, placeholder: "TELUS" },
              { name: "name", label: "Name", required: true, placeholder: "Telus Support" },
              { name: "clientName", label: "Client", required: true, placeholder: "Telus" },
              {
                name: "costCenterId",
                label: "Cost center",
                type: "select",
                required: true,
                options: costCenterOptions,
              },
            ]}
          />
        </Section>
      </PageBody>
    </>
  );
}
