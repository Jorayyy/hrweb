"use client";

import { useActionState } from "react";
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
    <form action={formAction} className="border-b border-zinc-200 bg-zinc-50 px-5 py-4">
      <div className="flex flex-wrap items-end gap-3">
        {fields.map((f) => {
          const error = errors[f.name];
          const base =
            "mt-1 w-full rounded-md border px-2.5 py-1.5 text-sm outline-none focus:border-zinc-500 " +
            (error ? "border-red-400" : "border-zinc-300");

          if (f.type === "checkbox") {
            return (
              <label key={f.name} className="flex items-center gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  name={f.name}
                  className="size-4 accent-zinc-900"
                  defaultChecked={f.defaultChecked}
                />
                {f.label}
              </label>
            );
          }

          if (f.type === "select") {
            return (
              <label key={f.name} className="min-w-44 flex-1 text-xs font-medium text-zinc-600">
                {f.label}
                <select name={f.name} required={f.required} defaultValue="" className={base}>
                  <option value="" disabled>
                    {f.placeholder ?? "Select…"}
                  </option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {error ? <span className="mt-0.5 block text-red-600">{error}</span> : null}
              </label>
            );
          }

          return (
            <label key={f.name} className="min-w-32 flex-1 text-xs font-medium text-zinc-600">
              {f.label}
              <input
                type={f.type === "number" ? "number" : "text"}
                name={f.name}
                required={f.required}
                placeholder={f.placeholder}
                className={base}
              />
              {error ? <span className="mt-0.5 block text-red-600">{error}</span> : null}
            </label>
          );
        })}

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>

      {state?.error ? <p className="mt-2 text-sm text-red-600">{state.error}</p> : null}
    </form>
  );
}
