"use client";

import { useActionState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Field, inputCx, selectCx } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import type { FormState } from "@/lib/form";
import { changePassword, saveCompany } from "./actions";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export type FieldSpec = {
  name: string;
  label: string;
  kind: "text" | "number" | "select" | "textarea";
  value: string | number;
  options?: readonly { value: string; label: string }[];
  min?: number;
  max?: number;
  maxLength?: number;
  hint?: string;
};

export function SettingsForm({ fields, action }: { fields: FieldSpec[]; action: Action }) {
  const [state, formAction, pending] = useActionState(action, null);
  const errors = state?.errors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <div
            key={f.name}
            className={f.kind === "select" ? undefined : "sm:col-span-2"}
          >
            <Field label={f.label} name={f.name} error={errors[f.name]}>
              {f.kind === "select" ? (
                <select
                  id={f.name}
                  name={f.name}
                  defaultValue={String(f.value)}
                  className={selectCx}
                >
                  {(f.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.kind === "textarea" ? (
                <textarea
                  id={f.name}
                  name={f.name}
                  defaultValue={String(f.value)}
                  maxLength={f.maxLength}
                  rows={3}
                  className={cn(inputCx, "h-auto min-h-20 py-2")}
                />
              ) : (
                <Input
                  id={f.name}
                  name={f.name}
                  type={f.kind}
                  defaultValue={String(f.value)}
                  min={f.min}
                  max={f.max}
                  maxLength={f.maxLength}
                />
              )}
            </Field>
            {f.hint ? <p className="mt-1 text-xs text-muted-foreground">{f.hint}</p> : null}
          </div>
        ))}
      </div>

      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state?.message ? <p className="text-sm text-emerald-600">{state.message}</p> : null}

      <Button type="submit" disabled={pending} size="sm">
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

export function CompanyForm({
  name,
  logo,
  contact,
}: {
  name: string;
  logo: string | null;
  contact: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(saveCompany, null);
  const errors = state?.errors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      <div className="flex items-start gap-4">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="Company logo" className="size-14 rounded-lg border border-border object-cover" />
        ) : (
          <div className="flex size-14 items-center justify-center rounded-lg border border-border bg-muted text-lg font-bold">
            HR
          </div>
        )}
        <div className="flex-1 space-y-3">
          <Field name="companyName" label="Company name" error={errors.companyName}>
            <Input id="companyName" name="companyName" defaultValue={name} required maxLength={80} />
          </Field>
          <Field name="logo" label="Logo" error={errors.logo}>
            <Input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="h-8" />
          </Field>
          {logo ? (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" name="removeLogo" className="size-4 accent-primary" />
              Remove current logo
            </label>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            ["companyAddress", "Address"],
            ["companyTin", "TIN"],
            ["companyDoleRegNo", "DOLE registration no."],
            ["companyPhone", "Phone"],
            ["companyEmail", "Email"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className={key === "companyAddress" ? "sm:col-span-2" : undefined}>
            <Field name={key} label={label} error={errors[key]}>
              <Input
                id={key}
                name={key}
                defaultValue={contact[key] ?? ""}
                maxLength={200}
                type={key === "companyEmail" ? "email" : "text"}
              />
            </Field>
          </div>
        ))}
      </div>

      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state?.message ? <p className="text-sm text-emerald-600">{state.message}</p> : null}

      <Button type="submit" disabled={pending} size="sm">
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

export function ChangePasswordForm({ minLength }: { minLength: number }) {
  const [state, formAction] = useActionState(changePassword, null);
  const errors = state?.errors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field name="currentPassword" label="Current password" error={errors.currentPassword}>
          <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
        </Field>
        <Field name="newPassword" label="New password" error={errors.newPassword}>
          <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={minLength} />
        </Field>
        <Field name="confirmPassword" label="Confirm new password" error={errors.confirmPassword}>
          <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={minLength} />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">At least {minLength} characters.</p>

      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state?.message ? <p className="text-sm text-emerald-600">{state.message}</p> : null}

      <SubmitButton size="sm">Change password</SubmitButton>
    </form>
  );
}
