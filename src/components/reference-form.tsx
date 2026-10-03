"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, selectCx } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { FormState } from "@/lib/form";

export type ReferenceField = {
  name: string;
  label: string;
  type?: "text" | "number" | "select" | "checkbox";
  required?: boolean;
  defaultChecked?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
};

export function ReferenceForm({
  action,
  fields,
  submitLabel = "Add",
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  fields: ReferenceField[];
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const errors = state?.errors ?? {};

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-3 border-b border-border bg-muted/40 px-4 py-3"
    >
      {fields.map((field) => {
        if (field.type === "checkbox") {
          return (
            <label key={field.name} className="flex items-center gap-2 pb-1.5 text-sm">
              <input
                type="checkbox"
                name={field.name}
                defaultChecked={field.defaultChecked}
                className="size-4 accent-primary"
              />
              {field.label}
            </label>
          );
        }

        return (
          <Field
            key={field.name}
            name={field.name}
            label={field.label}
            error={errors[field.name]}
            className="min-w-36 flex-1"
          >
            {field.type === "select" ? (
              <select
                id={field.name}
                name={field.name}
                required={field.required}
                defaultValue=""
                className={selectCx}
                aria-invalid={Boolean(errors[field.name])}
              >
                <option value="" disabled>
                  {field.placeholder ?? "Select…"}
                </option>
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id={field.name}
                name={field.name}
                type={field.type === "number" ? "number" : "text"}
                required={field.required}
                placeholder={field.placeholder}
                aria-invalid={Boolean(errors[field.name])}
              />
            )}
          </Field>
        );
      })}

      <Button type="submit" size="sm" disabled={pending} className="h-8">
        {pending ? "Saving…" : submitLabel}
      </Button>

      {state?.error ? (
        <p className="w-full text-xs text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}
