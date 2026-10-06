import { db } from "@/db";
import { jobPosition } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { PageBody, PageHeader } from "@/components/page-header";
import { ReferenceForm } from "@/components/reference-form";
import { addJobPosition } from "../actions";
import { Section } from "../section";

export default async function JobPositionsPage() {
  await requireRole("ADMIN", "HR");
  const positions = await db
    .select()
    .from(jobPosition)
    .orderBy(jobPosition.jobLevel, jobPosition.code);

  return (
    <>
      <PageHeader
        back
        title="Job positions"
        description="Drives salary bands and the BIR tax table variant."
      />

      <PageBody>
        <Section
          title="Job positions"
          description="Drives salary bands and the BIR tax table variant."
          columns={["Code", "Title", "Level", "BIR table"]}
          empty="No job positions yet."
          rows={positions.map((p) => ({
            key: p.id,
            cells: [p.code, p.title, String(p.jobLevel), p.isManagerial ? "Managerial" : "Non-managerial"],
          }))}
        >
          <ReferenceForm
            action={addJobPosition}
            fields={[
              { name: "code", label: "Code", required: true, placeholder: "CSR1" },
              { name: "title", label: "Title", required: true, placeholder: "Customer Service Rep" },
              { name: "jobLevel", label: "Level", type: "number" },
              { name: "isManagerial", label: "Managerial", type: "checkbox" },
            ]}
          />
        </Section>
      </PageBody>
    </>
  );
}
