import { db } from "@/db";
import { campaign, costCenter, department, jobPosition } from "@/db/schema";
import { PageBody, PageHeader } from "@/components/page-header";
import { ReferenceForm } from "@/components/reference-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { addCampaign, addCostCenter, addDepartment, addJobPosition } from "./actions";

type Row = { key: number | string; cells: React.ReactNode[] };

function Section({
  title,
  description,
  columns,
  rows,
  empty,
  children,
}: {
  title: string;
  description: string;
  columns: string[];
  rows: Row[];
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {children}
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => (
                  <TableHead key={c}>{c}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.key}>
                  {r.cells.map((cell, i) => (
                    <TableCell key={i} className={i === 0 ? "font-medium" : undefined}>
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
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
    <>
      <PageHeader
        title="Setup"
        description="Organization reference data — required before employees can be added"
      />

      <PageBody>
        <div className="space-y-6">
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
        </div>
      </PageBody>
    </>
  );
}
