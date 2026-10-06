"use client";

import { useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Field, selectCx } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";

type Action = (formData: FormData) => Promise<never>;

const OPEN_FREQS = ["SEMI_MONTHLY", "WEEKLY"] as const;
const ALL_FREQS = ["SEMI_MONTHLY", "MONTHLY", "WEEKLY", "DAILY"] as const;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function suggestPayDate(dateTo: string, freq: string): string {
  if (!dateTo) return "";
  if (freq === "WEEKLY" || freq === "DAILY")
    return new Date(Date.parse(`${dateTo}T00:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10);
  const [y, m, d] = dateTo.split("-").map(Number);
  if (d <= 15) return `${y}-${pad(m)}-25`;
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${pad(nm)}-10`;
}

export function CreatePayroll({ open, custom }: { open: Action; custom: Action }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<"standard" | "custom">("standard");
  const [freq, setFreq] = useState<string>("SEMI_MONTHLY");
  const [dateTo, setDateTo] = useState("");
  const [payDate, setPayDate] = useState("");
  const [payDirty, setPayDirty] = useState(false);

  const freqs = mode === "standard" ? OPEN_FREQS : ALL_FREQS;
  const switchMode = (m: "standard" | "custom") => {
    setMode(m);
    if (m === "standard" && freq !== "SEMI_MONTHLY" && freq !== "WEEKLY") setFreq("SEMI_MONTHLY");
  };
  const changeFreq = (f: string) => {
    setFreq(f);
    if (!payDirty && dateTo) setPayDate(suggestPayDate(dateTo, f));
  };

  return (
    <DialogPrimitive.Root open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button size="sm">Create payroll</Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-background p-4 shadow-md ring-1 ring-foreground/10 outline-hidden data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
          <DialogPrimitive.Title className="text-sm font-semibold">
            Create payroll
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-0.5 text-xs text-muted-foreground">
            Standard opens the current cutoff with auto dates and pay date. Custom lets you set the
            range yourself.
          </DialogPrimitive.Description>

          <form
            action={mode === "standard" ? open : custom}
            className="mt-4 grid gap-3 sm:grid-cols-2"
          >
            <div className="sm:col-span-2">
              <div className="flex w-fit gap-1 rounded-lg bg-muted p-1 text-sm">
                {(["standard", "custom"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchMode(m)}
                    className={`rounded-md px-3 py-1 transition-colors ${
                      mode === m
                        ? "bg-background font-medium shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m === "standard" ? "Standard cutoff" : "Custom dates"}
                  </button>
                ))}
              </div>
            </div>

            <Field label="Frequency" name="frequency">
              <select
                id="frequency"
                name="frequency"
                value={freq}
                onChange={(e) => changeFreq(e.target.value)}
                className={selectCx}
              >
                {freqs.map((f) => (
                  <option key={f} value={f}>
                    {f.replace("_", " ").toLowerCase()}
                  </option>
                ))}
              </select>
            </Field>

            {mode === "standard" ? (
              <p className="self-end text-xs text-muted-foreground">
                {freq === "WEEKLY"
                  ? "Opens this week (Mon–Sun), paid 7 days after."
                  : "Opens the current 1–15 or 16–last period, pay date auto."}
              </p>
            ) : (
              <>
                <Field label="Period code" name="periodCode">
                  <Input id="periodCode" name="periodCode" placeholder="2026-09-C" required />
                </Field>
                <Field label="Date from" name="dateFrom">
                  <Input id="dateFrom" name="dateFrom" type="date" required />
                </Field>
                <Field label="Date to" name="dateTo">
                  <Input
                    id="dateTo"
                    name="dateTo"
                    type="date"
                    required
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      if (!payDirty) setPayDate(suggestPayDate(e.target.value, freq));
                    }}
                  />
                </Field>
                <Field label="Pay date" name="payDate">
                  <Input
                    id="payDate"
                    name="payDate"
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => {
                      setPayDate(e.target.value);
                      setPayDirty(true);
                    }}
                  />
                </Field>
              </>
            )}

            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <SubmitButton size="sm">Create payroll</SubmitButton>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
