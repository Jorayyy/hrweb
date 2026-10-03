"use client";

import { useActionState } from "react";
import { cn } from "cn";
import type { employee as employeeSchema } from "@/db/schema";
import { Field, FormSection, inputCx, selectCx } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FormState } from "@/lib/form";

type Initial = typeof employeeSchema.$inferSelect;
type Option = { value: string; label: string };

type Selects = {
  campaigns: Option[];
  departments: Option[];
  costCenters: Option[];
  positions: Option[];
  managers: Option[];
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const invalidCx = "border-destructive ring-3 ring-destructive/20";

export function EmployeeForm({
  action,
  initial,
  selects,
  enums,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: Initial;
  selects: Selects;
  enums: { status: Option[]; employmentType: Option[]; payFrequency: Option[] };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const errors = state?.errors ?? {};
  const v = initial;

  const text = (name: keyof Initial): string => {
    const value = v?.[name];
    return value === null || value === undefined ? "" : String(value);
  };
  const invalid = (name: string) => (errors[name] ? true : undefined);
  const cx = (name: string, kind: "input" | "select" = "input") =>
    cn(kind === "select" ? selectCx : inputCx, errors[name] && invalidCx);

  const money = v ? (v.baseSalaryMonthly / 100).toFixed(2) : "";
  const restDays = new Set(v?.weeklyRestDays ?? []);
  const summary = Object.entries(errors);

  const selectField = (name: string, label: string, options: Option[]) => (
    <Field name={name} label={label} error={errors[name]}>
      <select
        id={name}
        name={name}
        required
        defaultValue={text(name as keyof Initial)}
        className={cx(name, "select")}
        aria-invalid={invalid(name)}
      >
        {!text(name as keyof Initial) && <option value="">Select…</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );

  return (
    <form action={formAction} className="space-y-6">
      {summary.length > 0 ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <p className="font-medium">Fix the following:</p>
          <ul className="mt-1 list-disc pl-5">
            {summary.map(([name, message]) => (
              <li key={name}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <FormSection title="Identity">
        <Field name="employeeNo" label="Employee no." error={errors.employeeNo}>
          <Input
            id="employeeNo"
            name="employeeNo"
            required
            defaultValue={text("employeeNo")}
            className={cx("employeeNo")}
            aria-invalid={invalid("employeeNo")}
          />
        </Field>
        <Field name="externalCode" label="Biometric code" error={errors.externalCode}>
          <Input
            id="externalCode"
            name="externalCode"
            required
            defaultValue={text("externalCode")}
            placeholder="Echoed by the time clock"
            className={cx("externalCode")}
            aria-invalid={invalid("externalCode")}
          />
        </Field>
        <Field name="email" label="Email" error={errors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={text("email")}
            className={cx("email")}
            aria-invalid={invalid("email")}
          />
        </Field>
        <Field name="firstName" label="First name" error={errors.firstName}>
          <Input
            id="firstName"
            name="firstName"
            required
            defaultValue={text("firstName")}
            className={cx("firstName")}
            aria-invalid={invalid("firstName")}
          />
        </Field>
        <Field name="middleName" label="Middle name" error={errors.middleName}>
          <Input
            id="middleName"
            name="middleName"
            defaultValue={text("middleName")}
            className={cx("middleName")}
          />
        </Field>
        <Field name="lastName" label="Last name" error={errors.lastName}>
          <Input
            id="lastName"
            name="lastName"
            required
            defaultValue={text("lastName")}
            className={cx("lastName")}
            aria-invalid={invalid("lastName")}
          />
        </Field>
      </FormSection>

      <FormSection title="Employment">
        <Field name="dateHired" label="Date hired" error={errors.dateHired}>
          <Input
            id="dateHired"
            name="dateHired"
            type="date"
            required
            defaultValue={text("dateHired")}
            className={cx("dateHired")}
            aria-invalid={invalid("dateHired")}
          />
        </Field>
        <Field name="dateRegularized" label="Date regularized" error={errors.dateRegularized}>
          <Input
            id="dateRegularized"
            name="dateRegularized"
            type="date"
            defaultValue={text("dateRegularized")}
            className={cx("dateRegularized")}
          />
        </Field>
        <Field name="dateSeparated" label="Date separated" error={errors.dateSeparated}>
          <Input
            id="dateSeparated"
            name="dateSeparated"
            type="date"
            defaultValue={text("dateSeparated")}
            className={cx("dateSeparated")}
          />
        </Field>
        <Field name="status" label="Status" error={errors.status}>
          <select
            id="status"
            name="status"
            required
            defaultValue={text("status") || "ACTIVE"}
            className={cx("status", "select")}
          >
            {enums.status.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field name="employmentType" label="Employment type" error={errors.employmentType}>
          <select
            id="employmentType"
            name="employmentType"
            required
            defaultValue={text("employmentType") || "REGULAR"}
            className={cx("employmentType", "select")}
          >
            {enums.employmentType.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field name="payFrequency" label="Pay frequency" error={errors.payFrequency}>
          <select
            id="payFrequency"
            name="payFrequency"
            required
            defaultValue={text("payFrequency") || "SEMI_MONTHLY"}
            className={cx("payFrequency", "select")}
          >
            {enums.payFrequency.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </FormSection>

      <FormSection title="Assignment" description="Reporting line and cost attribution.">
        {selectField("campaignId", "Campaign", selects.campaigns)}
        {selectField("departmentId", "Department", selects.departments)}
        {selectField("costCenterId", "Cost center", selects.costCenters)}
        {selectField("positionId", "Position", selects.positions)}
        <Field name="reportsToId" label="Reports to" error={errors.reportsToId}>
          <select
            id="reportsToId"
            name="reportsToId"
            defaultValue={text("reportsToId")}
            className={cx("reportsToId", "select")}
          >
            <option value="">— None —</option>
            {selects.managers.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </FormSection>

      <FormSection
        title="Pay"
        description="Daily rate = monthly ÷ 22; hourly rate = daily ÷ 8 (DOLE)."
      >
        <Field name="baseSalaryMonthly" label="Monthly basic salary (PHP)" error={errors.baseSalaryMonthly}>
          <Input
            id="baseSalaryMonthly"
            name="baseSalaryMonthly"
            required
            inputMode="decimal"
            placeholder="18000.00"
            defaultValue={money}
            className={cx("baseSalaryMonthly")}
            aria-invalid={invalid("baseSalaryMonthly")}
          />
        </Field>
        <div className="flex flex-wrap items-end gap-6 pb-1.5 text-sm sm:col-span-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isMinimumWageExempt"
              defaultChecked={v?.isMinimumWageExempt}
              className="size-4 accent-primary"
            />
            Minimum-wage exempt
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isManagerialTaxTbl"
              defaultChecked={v?.isManagerialTaxTbl}
              className="size-4 accent-primary"
            />
            Managerial tax table
          </label>
        </div>
      </FormSection>

      <FormSection title="Statutory numbers" description="Used on the monthly BIR and SSS reports.">
        <Field name="tinNo" label="TIN" error={errors.tinNo}>
          <Input id="tinNo" name="tinNo" defaultValue={text("tinNo")} className={cx("tinNo")} />
        </Field>
        <Field name="sssNo" label="SSS no." error={errors.sssNo}>
          <Input id="sssNo" name="sssNo" defaultValue={text("sssNo")} className={cx("sssNo")} />
        </Field>
        <Field name="philhealthNo" label="PhilHealth no." error={errors.philhealthNo}>
          <Input
            id="philhealthNo"
            name="philhealthNo"
            defaultValue={text("philhealthNo")}
            className={cx("philhealthNo")}
          />
        </Field>
        <Field name="pagibigNo" label="Pag-IBIG no." error={errors.pagibigNo}>
          <Input
            id="pagibigNo"
            name="pagibigNo"
            defaultValue={text("pagibigNo")}
            className={cx("pagibigNo")}
          />
        </Field>
        <Field name="rdoCode" label="RDO code" error={errors.rdoCode}>
          <Input id="rdoCode" name="rdoCode" defaultValue={text("rdoCode")} className={cx("rdoCode")} />
        </Field>
      </FormSection>

      <section className="border-t border-border pt-5">
        <h2 className="text-sm font-semibold">Weekly rest days</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Rest-day premiums apply to hours worked on these days.
        </p>
        <div className="mt-4 flex flex-wrap gap-4">
          {DAYS.map((day, index) => (
            <label key={day} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="weeklyRestDays"
                value={String(index)}
                defaultChecked={restDays.has(index)}
                className="size-4 accent-primary"
              />
              {day}
            </label>
          ))}
        </div>
        {errors.weeklyRestDays ? (
          <p className="mt-2 text-xs text-destructive">{errors.weeklyRestDays}</p>
        ) : null}
      </section>

      <div className="flex justify-end border-t border-border pt-5">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
