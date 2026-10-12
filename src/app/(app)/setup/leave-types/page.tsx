import { db } from "@/db";
import { leaveType } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { PageBody, PageHeader } from "@/components/page-header";
import { ReferenceForm } from "@/components/reference-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { addLeaveType, removeLeaveType } from "../actions";
import { Section } from "../section";

export default async function LeaveTypesPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  await requireRole("ADMIN", "HR");
  const params = (await searchParams) ?? {};
  const types = await db.select().from(leaveType).orderBy(leaveType.code);

  return (
    <>
      <PageHeader
        back
        title="Leave types"
        description="Vacation, sick and custom leave codes. Unpaid types post to payroll as LWP."
      />

      <PageBody>
        {params.error ? (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {params.error}
          </div>
        ) : null}

        <Section
          title="Leave types"
          description="Annual days reset every January — balance is computed from approved requests."
          columns={["Code", "Name", "Pay", "Annual days", "Status", ""]}
          empty="No leave types yet."
          rows={types.map((t) => ({
            key: t.id,
            cells: [
              t.code,
              t.name,
              <Badge key="pay" variant={t.isPaid ? "secondary" : "outline"}>
                {t.isPaid ? "Paid" : "Unpaid"}
              </Badge>,
              <span key="d" className="tabular-nums">
                {Number(t.annualDays).toFixed(1)}
              </span>,
              <Badge key="s" variant={t.isActive ? "default" : "outline"}>
                {t.isActive ? "Active" : "Inactive"}
              </Badge>,
              <form key="remove" action={removeLeaveType.bind(null, t.id)} className="text-right">
                <Button type="submit" variant="ghost" size="sm" className="text-destructive">
                  Remove
                </Button>
              </form>,
            ],
          }))}
        >
          <ReferenceForm
            action={addLeaveType}
            fields={[
              { name: "code", label: "Code", required: true, placeholder: "ML" },
              { name: "name", label: "Name", required: true, placeholder: "Maternity Leave" },
              { name: "annualDays", label: "Annual days", type: "number", placeholder: "5" },
              { name: "isPaid", label: "Paid", type: "checkbox", defaultChecked: true },
            ]}
            submitLabel="Add type"
          />
        </Section>
      </PageBody>
    </>
  );
}
