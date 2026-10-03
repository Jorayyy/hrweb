"use client";

import { useActionState } from "react";
import type { employee as employeeSchema } from "@/db/schema";
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

const input =
  "mt-1 w-full rounded-md border px-2.5 py-1.5 text-sm outline-none focus:border-zinc-500 border-zinc-300";
const inputErr = "mt-1 w-full rounded-md border border-red-400 px-2.5 py-1.5 text-sm outline-none";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Field({
  label,
  name,
  error,
  children,
  className,
}: {
  label: string;
  name: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label htmlFor={name} className={`block text-xs font-medium text-zinc-600 ${className ?? ""}`}>
      {label}
      {children}
      {error ? <span className="mt-0.5 block text-red-600">{error}</span> : null}
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-zinc-200 pt-5">
      <legend className="pr-3 text-sm font-semibold text-zinc-900">{title}</legend>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </fieldset>
  );
}

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
    if (value === null || value === undefined) return "";
    return String(value);
  };
  const money = v ? (v.baseSalaryMonthly / 100).toFixed(2) : "";
  const restDays = new Set(v?.weeklyRestDays ?? []);

  const summary = Object.entries(errors);
  const cls = (name: string) => (errors[name] ? inputErr : input);

  return (
    <form action={formAction} className="space-y-6">
      {summary.length > 0 ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-medium">Fix the following:</p>
          <ul className="mt-1 list-disc pl-5">
            {summary.map(([name, message]) => (
              <li key={name}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <Section title="Identity">
        <Field label="Employee no." name="employeeNo" error={errors.employeeNo}>
          <input name="employeeNo" required defaultValue={text("employeeNo")} className={cls("employeeNo")} />
        </Field>
        <Field
          label="Biometric code"
          name="externalCode"
          error={errors.externalCode}
        >
          <input name="externalCode" required defaultValue={text("externalCode")} className={cls("externalCode")} />
        </Field>
        <Field label="Email" name="email" error={errors.email}>
          <input name="email" type="email" defaultValue={text("email")} className={cls("email")} />
        </Field>
        <Field label="First name" name="firstName" error={errors.firstName}>
          <input name="firstName" required defaultValue={text("firstName")} className={cls("firstName")} />
        </Field>
        <Field label="Middle name" name="middleName" error={errors.middleName}>
          <input name="middleName" defaultValue={text("middleName")} className={cls("middleName")} />
        </Field>
        <Field label="Last name" name="lastName" error={errors.lastName}>
          <input name="lastName" required defaultValue={text("lastName")} className={cls("lastName")} />
        </Field>
      </Section>

      <Section title="Employment">
        <Field label="Date hired" name="dateHired" error={errors.dateHired}>
          <input
            name="dateHired"
            type="date"
            required
            defaultValue={text("dateHired")}
            className={cls("dateHired")}
          />
        </Field>
        <Field label="Date regularized" name="dateRegularized" error={errors.dateRegularized}>
          <input
            name="dateRegularized"
            type="date"
            defaultValue={text("dateRegularized")}
            className={cls("dateRegularized")}
          />
        </Field>
        <Field label="Date separated" name="dateSeparated" error={errors.dateSeparated}>
          <input
            name="dateSeparated"
            type="date"
            defaultValue={text("dateSeparated")}
            className={cls("dateSeparated")}
          />
        </Field>
        <Field label="Status" name="status" error={errors.status}>
          <select name="status" required defaultValue={text("status") || "ACTIVE"} className={cls("status")}>
            {enums.status.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Employment type" name="employmentType" error={errors.employmentType}>
          <select
            name="employmentType"
            required
            defaultValue={text("employmentType") || "REGULAR"}
            className={cls("employmentType")}
          >
            {enums.employmentType.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Pay frequency" name="payFrequency" error={errors.payFrequency}>
          <select
            name="payFrequency"
            required
            defaultValue={text("payFrequency") || "SEMI_MONTHLY"}
            className={cls("payFrequency")}
          >
            {enums.payFrequency.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Assignment">
        <Field label="Campaign" name="campaignId" error={errors.campaignId}>
          <select name="campaignId" required defaultValue={text("campaignId")} className={cls("campaignId")}>
            <option value="" disabled>
              Select…
            </option>
            {selects.campaigns.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Department" name="departmentId" error={errors.departmentId}>
          <select name="departmentId" required defaultValue={text("departmentId")} className={cls("departmentId")}>
            <option value="" disabled>
              Select…
            </option>
            {selects.departments.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Cost center" name="costCenterId" error={errors.costCenterId}>
          <select name="costCenterId" required defaultValue={text("costCenterId")} className={cls("costCenterId")}>
            <option value="" disabled>
              Select…
            </option>
            {selects.costCenters.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Position" name="positionId" error={errors.positionId}>
          <select name="positionId" required defaultValue={text("positionId")} className={cls("positionId")}>
            <option value="" disabled>
              Select…
            </option>
            {selects.positions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Reports to" name="reportsToId" error={errors.reportsToId}>
          <select name="reportsToId" defaultValue={text("reportsToId")} className={cls("reportsToId")}>
            <option value="">— None —</option>
            {selects.managers.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Pay">
        <Field
          label="Monthly basic salary (PHP)"
          name="baseSalaryMonthly"
          error={errors.baseSalaryMonthly}
          className="sm:col-span-1"
        >
          <input
            name="baseSalaryMonthly"
            required
            inputMode="decimal"
            placeholder="18000.00"
            defaultValue={money}
            className={cls("baseSalaryMonthly")}
          />
        </Field>
        <div className="flex items-end gap-6 pb-1 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isMinimumWageExempt"
              defaultChecked={v?.isMinimumWageExempt}
              className="size-4 accent-zinc-900"
            />
            Minimum-wage exempt
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isManagerialTaxTbl"
              defaultChecked={v?.isManagerialTaxTbl}
              className="size-4 accent-zinc-900"
            />
            Managerial tax table
          </label>
        </div>
      </Section>

      <Section title="Statutory numbers">
        <Field label="TIN" name="tinNo" error={errors.tinNo}>
          <input name="tinNo" defaultValue={text("tinNo")} className={cls("tinNo")} />
        </Field>
        <Field label="SSS no." name="sssNo" error={errors.sssNo}>
          <input name="sssNo" defaultValue={text("sssNo")} className={cls("sssNo")} />
        </Field>
        <Field label="PhilHealth no." name="philhealthNo" error={errors.philhealthNo}>
          <input name="philhealthNo" defaultValue={text("philhealthNo")} className={cls("philhealthNo")} />
        </Field>
        <Field label="Pag-IBIG no." name="pagibigNo" error={errors.pagibigNo}>
          <input name="pagibigNo" defaultValue={text("pagibigNo")} className={cls("pagibigNo")} />
        </Field>
        <Field label="RDO code" name="rdoCode" error={errors.rdoCode}>
          <input name="rdoCode" defaultValue={text("rdoCode")} className={cls("rdoCode")} />
        </Field>
      </Section>

      <fieldset className="border-t border-zinc-200 pt-5">
        <legend className="pr-3 text-sm font-semibold text-zinc-900">Weekly rest days</legend>
        <div className="mt-3 flex flex-wrap gap-4">
          {DAYS.map((day, index) => (
            <label key={day} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="weeklyRestDays"
                value={String(index)}
                defaultChecked={restDays.has(index)}
                className="size-4 accent-zinc-900"
              />
              {day}
            </label>
          ))}
        </div>
        {errors.weeklyRestDays ? (
          <p className="mt-1 text-sm text-red-600">{errors.weeklyRestDays}</p>
        ) : null}
      </fieldset>

      <div className="flex justify-end border-t border-zinc-200 pt-5">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
