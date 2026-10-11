"use client";

import { useActionState } from "react";
import { Field, selectCx } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { useActionToast } from "@/lib/use-action-toast";
import { createUser } from "../actions";

export function CreateUserForm({ roles }: { roles: readonly string[] }) {
  const [state, formAction] = useActionState(createUser, null);
  useActionToast(state);
  const errors = state?.errors ?? {};

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name" name="name" error={errors.name}>
        <Input id="name" name="name" required className={errors.name && "border-destructive"} />
      </Field>
      <Field label="Email" name="email" error={errors.email}>
        <Input
          id="email"
          name="email"
          type="email"
          required
          className={errors.email && "border-destructive"}
        />
      </Field>
      <Field label="Role" name="role" error={errors.role}>
        <select id="role" name="role" defaultValue="EMPLOYEE" className={selectCx}>
          {roles.map((r) => (
            <option key={r} value={r}>
              {r.charAt(0) + r.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Temporary password" name="password" error={errors.password}>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          className={errors.password && "border-destructive"}
        />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton size="sm">Create account</SubmitButton>
      </div>
    </form>
  );
}
