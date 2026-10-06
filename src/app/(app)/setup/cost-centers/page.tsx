import { db } from "@/db";
import { costCenter } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { PageBody, PageHeader } from "@/components/page-header";
import { ReferenceForm } from "@/components/reference-form";
import { Badge } from "@/components/ui/badge";
import { addCostCenter } from "../actions";
import { Section } from "../section";

export default async function CostCentersPage() {
  await requireRole("ADMIN", "HR");
  const costCenters = await db.select().from(costCenter).orderBy(costCenter.code);

  return (
    <>
      <PageHeader
        back
        title="Cost centers"
        description="Where cost is attributed for reporting and payroll."
      />

      <PageBody>
        <Section
          title="Cost centers"
          description="Where cost is attributed for reporting and payroll."
          columns={["Code", "Name", "Status"]}
          empty="No cost centers yet."
          rows={costCenters.map((c) => ({
            key: c.id,
            cells: [
              c.code,
              c.name,
              c.isActive ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>,
            ],
          }))}
        >
          <ReferenceForm
            action={addCostCenter}
            fields={[
              { name: "code", label: "Code", required: true, placeholder: "CC-OPS" },
              { name: "name", label: "Name", required: true, placeholder: "Operations" },
            ]}
          />
        </Section>
      </PageBody>
    </>
  );
}
