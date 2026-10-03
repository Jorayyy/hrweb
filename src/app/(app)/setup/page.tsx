import { db } from "@/db";
import { campaign, costCenter, department, jobPosition } from "@/db/schema";
import { ReferenceForm } from "@/components/reference-form";
import { addCampaign, addCostCenter, addDepartment, addJobPosition } from "./actions";

type Row = { key: number | string; cells: string[] };

function Section({
  title,
  columns,
  rows,
  empty,
  children,
}: {
  title: string;
  columns: string[];
  rows: Row[];
  empty: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-5 py-3 text-sm font-semibold">{title}</div>
      {children}
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-zinc-500">{empty}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">
              {columns.map((c) => (
                <th key={c} className="px-5 py-2 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-zinc-100">
                {r.cells.map((cell, i) => (
                  <td key={i} className="px-5 py-2">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default async function SetupPage() {
  const [costCenters, campaigns, departments, positions] = await Promise.all([
    db.select().from(costCenter).orderBy(costCenter.code),
    db.select().from(campaign).orderBy(campaign.code),
    db.select().from(department).orderBy(department.code),
    db.select().from(jobPosition).orderBy(jobPosition.jobLevel, jobPosition.code),
  ]);

  const costCenterOptions = costCenters.map((c) => ({
    value: String(c.id),
    label: `${c.code} — ${c.name}`,
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-8 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Setup</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Organization reference data. Employees cannot be created until these exist.
        </p>
      </div>

      <Section
        title="Cost centers"
        columns={["Code", "Name", "Status"]}
        empty="No cost centers yet."
        rows={costCenters.map((c) => ({
          key: c.id,
          cells: [c.code, c.name, c.isActive ? "Active" : "Inactive"],
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

      <Section
        title="Campaigns"
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

      <Section
        title="Departments"
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

      <Section
        title="Job positions"
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
    </div>
  );
}
