"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { selectCx } from "@/components/ui/field";

export function PeriodSelect({
  options,
}: {
  options: { runId: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const value = sp.get("period") ?? "";

  return (
    <select
      aria-label="Select a Payroll Period"
      value={value}
      onChange={(e) => {
        const next = new URLSearchParams(sp.toString());
        if (e.target.value) next.set("period", e.target.value);
        else next.delete("period");
        router.replace(`${pathname}?${next.toString()}`);
      }}
      className={`${selectCx} w-56 cursor-pointer`}
    >
      <option value="">Select a Payroll Period</option>
      {options.map((o) => (
        <option key={o.runId} value={o.runId}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
