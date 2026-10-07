"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchIcon, XIcon } from "lucide-react";
import { selectCx } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type Opt = { id: number; name: string };

export function EmployeeFilters({
  campaigns,
  departments,
  costCenters,
}: {
  campaigns: Opt[];
  departments: Opt[];
  costCenters?: Opt[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [pending, startTransition] = useTransition();

  const go = (patch: Record<string, string>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  };

  const campaign = sp.get("campaign") ?? "";
  const dept = sp.get("dept") ?? "";
  const cc = sp.get("cc") ?? "";
  const active = Boolean(campaign || dept || cc || (sp.get("q") ?? "").trim());

  return (
    <div className={`flex flex-wrap items-center gap-2 ${pending ? "opacity-60" : ""}`}>
      <select
        aria-label="Filter by campaign"
        value={campaign}
        onChange={(e) => go({ campaign: e.target.value })}
        className={`${selectCx} w-44 cursor-pointer`}
      >
        <option value="">All campaigns</option>
        {campaigns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter by group"
        value={dept}
        onChange={(e) => go({ dept: e.target.value })}
        className={`${selectCx} w-44 cursor-pointer`}
      >
        <option value="">All groups</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      {costCenters ? (
        <select
          aria-label="Filter by cost center"
          value={cc}
          onChange={(e) => go({ cc: e.target.value })}
          className={`${selectCx} w-44 cursor-pointer`}
        >
          <option value="">All cost centers</option>
          {costCenters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go({ q: q.trim() });
        }}
        className="relative"
      >
        <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search employee…"
          aria-label="Search employee"
          className="w-48 pl-7"
        />
      </form>
      {active ? (
        <button
          type="button"
          onClick={() => {
            setQ("");
            go({ campaign: "", dept: "", cc: "", q: "" });
          }}
          className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <XIcon className="size-3.5" />
          Clear
        </button>
      ) : null}
    </div>
  );
}
