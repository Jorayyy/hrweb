"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { saveCompany } from "./actions";

export function CompanyForm({
  name,
  logo,
}: {
  name: string;
  logo: string | null;
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

      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state?.message ? <p className="text-sm text-emerald-600">{state.message}</p> : null}

      <Button type="submit" disabled={pending} size="sm">
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
