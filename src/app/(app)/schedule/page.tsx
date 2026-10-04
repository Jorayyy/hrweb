import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { employee, shiftTemplate } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { PageBody, PageHeader } from "@/components/page-header";
import { ReferenceForm } from "@/components/reference-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { selectCx } from "@/components/ui/field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { addShift, assignShift, removeShift } from "./actions";

export default async function SchedulePage() {
  await requireRole("ADMIN", "HR");

  const [shifts, employees] = await Promise.all([
    db.select().from(shiftTemplate).orderBy(shiftTemplate.code),
    db
      .select({
        id: employee.id,
        employeeNo: employee.employeeNo,
        firstName: employee.firstName,
        lastName: employee.lastName,
        shiftTemplateId: employee.shiftTemplateId,
      })
      .from(employee)
      .where(inArray(employee.status, ["ACTIVE", "ON_LEAVE"]))
      .orderBy(employee.lastName, employee.firstName)
      .limit(500),
  ]);

  const shiftOptions = shifts.map((s) => ({ value: String(s.id), label: `${s.code} — ${s.name}` }));
  const shiftLabel = (id: number | null) =>
    id ? (shifts.find((s) => s.id === id)?.code ?? "—") : "No shift";

  return (
    <>
      <PageHeader
        back
        title="Schedule"
        description="Shift templates and per-employee assignment — the time basis for lateness, OT and break variances"
      />
      <PageBody>
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Shift templates</CardTitle>
              <CardDescription>
                Lunch is unpaid; AM/PM breaks are paid. Overnight shifts are supported (end time
                earlier than start).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ReferenceForm
                action={addShift}
                submitLabel="Add shift"
                fields={[
                  { name: "code", label: "Code", required: true, placeholder: "DAY8" },
                  { name: "name", label: "Name", required: true, placeholder: "Day 8AM–5PM" },
                  { name: "startsAt", label: "Start", type: "time", required: true },
                  { name: "endsAt", label: "End", type: "time", required: true },
                  { name: "break1Start", label: "1st break from", type: "time", required: true },
                  { name: "break1End", label: "1st break to", type: "time", required: true },
                  { name: "lunchStart", label: "Lunch from", type: "time", required: true },
                  { name: "lunchEnd", label: "Lunch to", type: "time", required: true },
                  { name: "break2Start", label: "2nd break from", type: "time", required: true },
                  { name: "break2End", label: "2nd break to", type: "time", required: true },
                ]}
              />
              {shifts.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No shifts yet — employees cannot punch without one.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Shift</TableHead>
                      <TableHead>Break windows</TableHead>
                      <TableHead className="text-right">Assigned</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shifts.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.code}</TableCell>
                        <TableCell>{s.name}</TableCell>
                        <TableCell className="tabular-nums">
                          {s.startsAt} – {s.endsAt}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums text-muted-foreground">
                          {s.break1Start}–{s.break1End} · {s.lunchStart}–{s.lunchEnd} ·{" "}
                          {s.break2Start}–{s.break2End}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {employees.filter((e) => e.shiftTemplateId === s.id).length}
                        </TableCell>
                        <TableCell className="text-right">
                          <form action={removeShift.bind(null, s.id)}>
                            <Button type="submit" variant="ghost" size="sm" className="text-destructive">
                              Remove
                            </Button>
                          </form>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Employee assignments</CardTitle>
              <CardDescription>Everyone needs a shift before they can punch in.</CardDescription>
            </CardHeader>
            <CardContent>
              {employees.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No employees yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Current shift</TableHead>
                      <TableHead className="w-72">Assign</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>
                          <span className="block font-medium">
                            {e.lastName}, {e.firstName}
                          </span>
                          <span className="block text-xs text-muted-foreground">{e.employeeNo}</span>
                        </TableCell>
                        <TableCell>{shiftLabel(e.shiftTemplateId)}</TableCell>
                        <TableCell>
                          <form action={assignShift} className="flex items-center gap-2">
                            <input type="hidden" name="employeeId" value={e.id} />
                            <select
                              name="shiftTemplateId"
                              defaultValue={e.shiftTemplateId ? String(e.shiftTemplateId) : ""}
                              className={selectCx}
                            >
                              <option value="">No shift</option>
                              {shiftOptions.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                            <Button type="submit" variant="outline" size="sm">
                              Apply
                            </Button>
                          </form>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
