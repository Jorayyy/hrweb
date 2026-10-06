import { db } from "@/db";
import { costCenter, department } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { PageBody, PageHeader } from "@/components/page-header";
import { ReferenceForm } from "@/components/reference-form";
import { addDepartment } from "../actions";
import { Section } from "../section";

export default async function DepartmentsPage() {
  await requireRole("ADMIN", "HR");
  const [departments, costCenters] = await Promise.all([
    db.select().from(department).orderBy(department.code),
    db.select().from(costCenter).orderBy(costCenter.code),
  ]);

  const costCenterOptions = costCenters.map((c) => ({
    value: String(c.id),
    label: `${c.code} — ${c.name}`,
  }));

  return (
    <>
      <PageHeader back title="Departments" description="Reporting units inside the organization." />

      <PageBody>
        <Section
          title="Departments"
          description="Reporting units inside the organization."
          columns={["Code", "Name", "Cost center"]}
          empty="No departments yet."
          rows={departments.map((d) => ({
            key: d.id,
            cells: [
              d.code,
              d.name,
              costCenters.find((x) => x.id === d.costCenterId)?.code ?? "—",
            ],
          }))}
        >
          <ReferenceForm
            action={addDepartment}
            fields={[
              { name: "code", label: "Code", required: true, placeholder: "WFM" },
              { name: "name", label: "Name", required: true, placeholder: "Workforce Management" },
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
