"use client";

import { useEffect, useRef, useState, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { MANILA_OFFSET_MS } from "@/lib/time";
import { punch } from "./actions";

export function Clock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const d = new Date(now + MANILA_OFFSET_MS);
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="text-center">
      <div className="text-6xl font-semibold tabular-nums text-white sm:text-7xl">
        {pad(d.getUTCHours())}:{pad(d.getUTCMinutes())}
        <span className="text-3xl text-zinc-500 sm:text-4xl">:{pad(d.getUTCSeconds())}</span>
      </div>
      <div className="mt-2 text-sm text-zinc-400">
        {days[d.getUTCDay()]}, {months[d.getUTCMonth()]} {d.getUTCDate()}, {d.getUTCFullYear()}
      </div>
    </div>
  );
}

const BUTTONS: [string, string][] = [
  ["in", "IN"],
  ["break1Out", "1st Break Out"],
  ["break1In", "1st Break In"],
  ["lunchOut", "Lunch Out"],
  ["lunchIn", "Lunch In"],
  ["break2Out", "2nd Break Out"],
  ["break2In", "2nd Break In"],
  ["out", "OUT"],
];

const darkCx =
  "h-12 text-base bg-white/5 border-white/15 text-white placeholder:text-zinc-500 hover:border-white/25 focus-visible:border-white/40 focus-visible:ring-white/20";

export function BundyForm() {
  const [state, formAction, pending] = useActionState(punch, null);
  const successRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state?.message && successRef.current) successRef.current.scrollIntoView({ block: "nearest" });
  }, [state]);

  return (
    <form action={formAction} className="w-full space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="employeeNo" label="Employee no." className="text-zinc-400">
          <Input
            id="employeeNo"
            name="employeeNo"
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="E-0032"
            className={darkCx}
            required
          />
        </Field>
        <Field name="pin" label="Bundy PIN" className="text-zinc-400">
          <Input
            id="pin"
            name="pin"
            type="password"
            inputMode="numeric"
            maxLength={6}
            autoComplete="off"
            placeholder="••••"
            className={`${darkCx} tracking-widest`}
            required
          />
        </Field>
      </div>

      {state?.error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-400">
          {state.error}
        </p>
      ) : null}
      {state?.message ? (
        <p
          ref={successRef}
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-center text-sm font-medium text-emerald-400"
        >
          {state.message}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        {BUTTONS.map(([slot, label]) => (
          <Button
            key={slot}
            type="submit"
            name="slot"
            value={slot}
            disabled={pending}
            variant={slot === "in" || slot === "out" ? "default" : "secondary"}
            className="h-12 text-sm font-semibold"
          >
            {label}
          </Button>
        ))}
      </div>
    </form>
  );
}
