"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { dateKeyDayOfWeek } from "@/lib/attendance/anchor";
import { addDays, mondayOf } from "@/lib/attendance/review";
import { Button } from "@/components/ui/button";

const DOW = ["M", "T", "W", "T", "F", "S", "S"];

export function WeekPicker({ w, today }: { w: string; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(w.slice(0, 7));

  const year = Number(month.slice(0, 4));
  const mon = Number(month.slice(5, 7));
  const first = `${month}-01`;
  const lead = (dateKeyDayOfWeek(first) + 6) % 7;
  const start = addDays(first, -lead);
  const prevMonth = new Date(Date.UTC(year, mon - 2, 1)).toISOString().slice(0, 7);
  const nextMonth = new Date(Date.UTC(year, mon, 1)).toISOString().slice(0, 7);
  const weekEnd = addDays(w, 6);
  const label = new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric" }).format(
    new Date(`${first}T12:00:00Z`),
  );

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setMonth(w.slice(0, 7));
      }}
    >
      <PopoverPrimitive.Trigger asChild>
        <Button variant="outline" size="sm" aria-label="Pick a week" title="Pick a week">
          <CalendarDaysIcon />
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          className="z-50 rounded-lg bg-popover p-2 shadow-md ring-1 ring-foreground/10 outline-hidden data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
        >
          <div className="mb-1 flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Previous month"
              onClick={() => setMonth(prevMonth)}
            >
              <ChevronLeftIcon />
            </Button>
            <span className="text-sm font-medium tabular-nums">{label}</span>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Next month"
              onClick={() => setMonth(nextMonth)}
            >
              <ChevronRightIcon />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {DOW.map((d, i) => (
              <span
                key={i}
                className="flex size-7 items-center justify-center text-[10px] font-medium text-muted-foreground"
              >
                {d}
              </span>
            ))}
            {Array.from({ length: 42 }, (_, i) => {
              const day = addDays(start, i);
              const outOfMonth = day.slice(0, 7) !== month;
              const inWeek = day >= w && day <= weekEnd;
              return (
                <button
                  key={day}
                  type="button"
                  aria-label={day}
                  onClick={() => {
                    setOpen(false);
                    router.push(`/dtr-review?w=${mondayOf(day)}`);
                  }}
                  className={`flex size-7 items-center justify-center rounded-md text-xs tabular-nums transition-colors hover:bg-muted ${
                    outOfMonth ? "text-muted-foreground/40" : ""
                  } ${
                    inWeek
                      ? "bg-primary/15 font-medium text-primary hover:bg-primary/25"
                      : ""
                  } ${day === today ? "ring-1 ring-primary" : ""}`}
                >
                  {Number(day.slice(8))}
                </button>
              );
            })}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
