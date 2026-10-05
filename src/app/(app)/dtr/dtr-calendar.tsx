"use client";

import { useState } from "react";
import { Banknote } from "lucide-react";
import { humanize } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type DtrDay = {
  key: string;
  dow: number;
  dayNum: number;
  status: string | null;
  in: string;
  out: string;
  worked: string;
  sched: string;
  late: string;
  ot: string;
  restDay: boolean;
  holiday: string | null;
  holidayKind: string | null;
  payCode: string | null;
  needsReview: boolean;
  future: boolean;
};

const COLS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_BG: Record<string, string> = {
  PRESENT: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900",
  HALF_DAY: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900",
  ABSENT: "bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900",
  LEAVE: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900",
};

function cellTone(d: DtrDay): string {
  if (d.status && STATUS_BG[d.status]) return STATUS_BG[d.status];
  if (d.future) return "bg-muted/20";
  if (d.restDay) return "bg-muted/40";
  return "bg-background border-dashed";
}

function mainLine(d: DtrDay): string {
  if (!d.status) return d.future ? "" : "No record";
  if (d.status === "PRESENT") return `${d.worked}h`;
  if (d.status === "HALF_DAY") return "Half day";
  if (d.status === "ABSENT") return "Absent";
  return humanize(d.status);
}

function DtrCalendar({ days, todayKey }: { days: DtrDay[]; todayKey: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const sel = days.find((d) => d.key === selected) ?? null;

  const firstDow = days[0]?.dow ?? 0;
  const cells: (DtrDay | null)[] = [...Array.from({ length: firstDow }, () => null), ...days];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {COLS.map((c) => (
          <div key={c} className="pb-1 text-center text-xs font-medium text-muted-foreground">
            {c}
          </div>
        ))}
        {cells.map((d, i) =>
          d ? (
            <button
              key={d.key}
              type="button"
              onClick={() => setSelected(d.key === selected ? null : d.key)}
              aria-pressed={d.key === selected}
              className={`flex min-h-20 flex-col gap-0.5 rounded-lg border p-1.5 text-left transition-colors outline-none hover:border-ring focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-24 ${cellTone(d)} ${
                d.key === todayKey ? "ring-2 ring-primary" : ""
              } ${d.key === selected ? "border-ring" : ""}`}
            >
              <span className="flex items-center justify-between gap-1">
                <span
                  className={`text-xs tabular-nums ${d.key === todayKey ? "font-bold" : "text-muted-foreground"}`}
                >
                  {d.dayNum}
                </span>
                <span className="flex items-center gap-0.5">
                  {d.payCode ? (
                    <Banknote className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label={`Pay day ${d.payCode}`} />
                  ) : null}
                  {d.needsReview ? <span className="size-2 shrink-0 rounded-full bg-destructive" aria-label="Needs review" /> : null}
                </span>
              </span>
              <span className="text-xs font-medium">{mainLine(d)}</span>
              {d.status ? (
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {d.in !== "—" || d.out !== "—" ? `${d.in}–${d.out}` : ""}
                </span>
              ) : null}
              <span className="flex flex-wrap gap-0.5">
                {d.restDay ? (
                  <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">Rest</span>
                ) : null}
                {d.ot !== "—" ? (
                  <span className="rounded bg-blue-100 px-1 text-[10px] text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    OT {d.ot}h
                  </span>
                ) : null}
                {d.late !== "—" ? (
                  <span className="rounded bg-amber-100 px-1 text-[10px] text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                    {d.late}
                  </span>
                ) : null}
                {d.holiday ? (
                  <span className="truncate rounded bg-violet-100 px-1 text-[10px] text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                    {humanize(d.holidayKind ?? "SPECIAL")}
                  </span>
                ) : null}
              </span>
            </button>
          ) : (
            <div key={`blank-${i}`} className="min-h-20 sm:min-h-24" />
          ),
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30" />
          Present
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30" />
          Half day
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm border border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30" />
          Absent
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm border border-dashed border-border bg-background" />
          No record
        </span>
        <span className="flex items-center gap-1.5">
          <Banknote className="size-3.5 text-emerald-600 dark:text-emerald-400" /> Pay day
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-destructive" /> Needs review
        </span>
        <span className="text-muted-foreground">Click a day for details.</span>
      </div>

      {sel ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {new Intl.DateTimeFormat("en-PH", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
                timeZone: "UTC",
              }).format(new Date(`${sel.key}T12:00:00Z`))}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-y-2 text-sm sm:grid-cols-3">
            <span className="text-muted-foreground">Status</span>
            <span>{sel.status ? humanize(sel.status) : sel.future ? "Upcoming" : "No record"}</span>
            <span className="text-muted-foreground">In / Out</span>
            <span className="tabular-nums">
              {sel.in} → {sel.out}
            </span>
            <span className="text-muted-foreground">Hours</span>
            <span className="tabular-nums">
              {sel.worked}h worked / {sel.sched}h scheduled
            </span>
            <span className="text-muted-foreground">Late</span>
            <span className="tabular-nums">{sel.late}</span>
            <span className="text-muted-foreground">Overtime</span>
            <span className="tabular-nums">{sel.ot === "—" ? "—" : `${sel.ot}h`}</span>
            <span className="text-muted-foreground">Flags</span>
            <span className="flex flex-wrap gap-1">
              {sel.restDay ? <Badge variant="outline">Rest day</Badge> : null}
              {sel.holiday ? <Badge variant="outline">{sel.holiday}</Badge> : null}
              {sel.payCode ? <Badge variant="secondary">Pay day · {sel.payCode}</Badge> : null}
              {sel.needsReview ? <Badge variant="destructive">Needs review</Badge> : null}
              {!sel.restDay && !sel.holiday && !sel.payCode && !sel.needsReview ? (
                <span className="text-muted-foreground">—</span>
              ) : null}
            </span>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export default DtrCalendar;
