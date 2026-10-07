"use client";

import { useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";

type Opt = { id: number; name: string };
type Action = (formData: FormData) => Promise<never>;

function ScopeGroup({ legend, name, options }: { legend: string; name: string; options: Opt[] }) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-xs font-medium text-muted-foreground">{legend}</legend>
      <div className="mt-1 max-h-36 overflow-y-auto rounded-lg border border-border p-2">
        {options.length === 0 ? (
          <p className="text-xs text-muted-foreground">None yet.</p>
        ) : (
          options.map((o) => (
            <label key={o.id} className="flex items-center gap-2 py-0.5 text-sm">
              <input type="checkbox" name={name} value={o.id} className="size-4 accent-primary" />
              <span className="truncate">{o.name}</span>
            </label>
          ))
        )}
      </div>
    </fieldset>
  );
}

export function NewRun({
  action,
  campaigns,
  departments,
  costCenters,
}: {
  action: Action;
  campaigns: Opt[];
  departments: Opt[];
  costCenters: Opt[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button variant="outline" size="sm">
          New run
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-background p-4 shadow-md ring-1 ring-foreground/10 outline-hidden data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
          <DialogPrimitive.Title className="text-sm font-semibold">
            New run
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-0.5 text-xs text-muted-foreground">
            Snapshots the statutory tables in force for this cutoff. Leave everything unchecked to
            pay the full roster, or tick dimensions to run a partial payroll (filters combine with
            AND).
          </DialogPrimitive.Description>

          <form action={action} className="mt-4 grid gap-3 sm:grid-cols-3">
            <ScopeGroup legend="Campaigns" name="campaignIds" options={campaigns} />
            <ScopeGroup legend="Departments" name="departmentIds" options={departments} />
            <ScopeGroup legend="Cost centers" name="costCenterIds" options={costCenters} />

            <div className="flex justify-end gap-2 sm:col-span-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton size="sm">Create run</SubmitButton>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
