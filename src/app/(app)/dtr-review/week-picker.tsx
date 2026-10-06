"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { dateKeyDayOfWeek } from "@/lib/attendance/anchor";
import { addDays } from "@/lib/attendance/review";
import { Button } from "@/components/ui/button";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function WeekPicker({ w, today }: { w: string; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(w);

  const days = Array.from({ length: 7 }, (_, i) => addDays(view, i));
  const weekEnd = addDays(view, 6);
  const monthFmt = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" });
  const sameMonth = view.slice(0, 7) === weekEnd.slice(0, 7);
  const label = sameMonth
    ? `${monthFmt.format(new Date(`${view}T12:00:00Z`))} – ${Number(weekEnd.slice(8))}, ${weekEnd.slice(0, 4)}`
    : `${monthFmt.format(new Date(`${view}T12:00:00Z`))} – ${monthFmt.format(new Date(`${weekEnd}T12:00:00Z`))}, ${weekEnd.slice(0, 4)}`;

  const pick = () => {
    const next = new URLSearchParams(sp.toString());
    next.set("w", view);
    next.delete("page");
    setOpen(false);
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setView(w);
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
          <div className="mb-2 flex items-center justify-between gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Previous week"
              onClick={() => setView(addDays(view, -7))}
            >
              <ChevronLeftIcon />
            </Button>
            <span className="text-sm font-medium tabular-nums">{label}</span>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Next week"
              onClick={() => setView(addDays(view, 7))}
            >
              <ChevronRightIcon />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => (
              <button
                key={day}
                type="button"
                aria-label={day}
                onClick={pick}
                className={`flex w-8 flex-col items-center gap-0.5 rounded-md py-1.5 transition-colors hover:bg-muted ${
                  view === w ? "bg-primary/10 text-primary hover:bg-primary/20" : ""
                } ${day === today ? "ring-1 ring-primary" : ""}`}
              >
                <span className="text-[10px] font-medium text-muted-foreground">
                  {DAY_NAMES[(dateKeyDayOfWeek(day) + 6) % 7]}
                </span>
                <span className="text-sm tabular-nums">{Number(day.slice(8))}</span>
              </button>
            ))}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
