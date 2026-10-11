"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { selectCx } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Opt = { id: number; name: string };

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Opt[];
  allLabel: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${selectCx} cursor-pointer`}
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}

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
  const count = [campaign, dept, cc].filter(Boolean).length;
  const active = Boolean(count || (sp.get("q") ?? "").trim());

  return (
    <div className={`flex flex-wrap items-center gap-2 ${pending ? "opacity-60" : ""}`}>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="text-muted-foreground">
            <SlidersHorizontalIcon />
            Filters
            {count ? (
              <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                {count}
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="space-y-3">
          <FilterSelect
            label="Campaign"
            value={campaign}
            onChange={(v) => go({ campaign: v })}
            options={campaigns}
            allLabel="All campaigns"
          />
          <FilterSelect
            label="Group"
            value={dept}
            onChange={(v) => go({ dept: v })}
            options={departments}
            allLabel="All groups"
          />
          {costCenters ? (
            <FilterSelect
              label="Cost center"
              value={cc}
              onChange={(v) => go({ cc: v })}
              options={costCenters}
              allLabel="All cost centers"
            />
          ) : null}
        </PopoverContent>
      </Popover>
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
