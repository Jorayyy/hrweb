"use client";

import { useActionState } from "react";
import { saveAttendanceDay } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, selectCx } from "@/components/ui/field";

export type EmployeeOption = { id: number; label: string };

export type EntryInitial = {
  employeeId: string;
  workDate: string;
  status: string;
  punchIn: string;
  break1Out: string;
  break1In: string;
  lunchOut: string;
  lunchIn: string;
  break2Out: string;
  break2In: string;
  punchOut: string;
  scheduledHours: string;
};

export function EntryForm({
  employees,
  statuses,
  date,
  initial,
}: {
  employees: readonly EmployeeOption[];
  statuses: readonly string[];
  date: string;
  initial: EntryInitial | null;
}) {
  const [state, formAction, pending] = useActionState(saveAttendanceDay, null);
  const errors = state?.errors ?? {};
  const summary = Object.values(errors);

  return (
    <form action={formAction} className="space-y-4">
      {summary.length > 0 ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {summary.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Employee" name="employeeId" error={errors.employeeId}>
          <select
            id="employeeId"
            name="employeeId"
            defaultValue={initial?.employeeId ?? ""}
            required
            className={selectCx}
          >
            <option value="">Select employee…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date" name="workDate" error={errors.workDate}>
          <Input
            id="workDate"
            name="workDate"
            type="date"
            defaultValue={initial?.workDate ?? date}
            required
          />
        </Field>
        <Field label="Status" name="status" error={errors.status}>
          <select
            id="status"
            name="status"
            defaultValue={initial?.status ?? "PRESENT"}
            className={selectCx}
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s
                  .split("_")
                  .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
                  .join(" ")}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Punch in (Manila)" name="punchIn" error={errors.punchIn}>
          <Input id="punchIn" name="punchIn" type="time" defaultValue={initial?.punchIn} />
        </Field>
        <Field label="1st break out" name="break1Out" error={errors.break1Out}>
          <Input id="break1Out" name="break1Out" type="time" defaultValue={initial?.break1Out} />
        </Field>
        <Field label="1st break in" name="break1In" error={errors.break1In}>
          <Input id="break1In" name="break1In" type="time" defaultValue={initial?.break1In} />
        </Field>
        <Field label="Lunch out" name="lunchOut" error={errors.lunchOut}>
          <Input id="lunchOut" name="lunchOut" type="time" defaultValue={initial?.lunchOut} />
        </Field>
        <Field label="Lunch in" name="lunchIn" error={errors.lunchIn}>
          <Input id="lunchIn" name="lunchIn" type="time" defaultValue={initial?.lunchIn} />
        </Field>
        <Field label="2nd break out" name="break2Out" error={errors.break2Out}>
          <Input id="break2Out" name="break2Out" type="time" defaultValue={initial?.break2Out} />
        </Field>
        <Field label="2nd break in" name="break2In" error={errors.break2In}>
          <Input id="break2In" name="break2In" type="time" defaultValue={initial?.break2In} />
        </Field>
        <Field label="Punch out (Manila)" name="punchOut" error={errors.punchOut}>
          <Input id="punchOut" name="punchOut" type="time" defaultValue={initial?.punchOut} />
        </Field>
        <Field label="Scheduled hours" name="scheduledHours" error={errors.scheduledHours}>
          <Input
            id="scheduledHours"
            name="scheduledHours"
            type="number"
            min="0.5"
            max="24"
            step="0.5"
            defaultValue={initial?.scheduledHours ?? "8"}
            required
          />
        </Field>
      </div>

      <div className="flex justify-end border-t border-border pt-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : initial ? "Update entry" : "Add entry"}
        </Button>
      </div>
    </form>
  );
}
