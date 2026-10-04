"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

type Progress = { runStatus: string; total: number; done: number; failed: number };

export function CalculateButton({
  action,
  runId,
}: {
  action: () => Promise<never>;
  runId: number;
}) {
  const [pending, startTransition] = useTransition();
  const [prog, setProg] = useState<Progress | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!pending) {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
      return;
    }
    timer.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/payroll/${runId}/progress`, { cache: "no-store" });
        if (res.ok) setProg((await res.json()) as Progress);
      } catch {
        // keep last known progress
      }
    }, 400);
    return () => {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    };
  }, [pending, runId]);

  if (pending) {
    const processed = prog ? prog.done + prog.failed : 0;
    const pct = prog && prog.total > 0 ? Math.round((processed / prog.total) * 100) : 4;
    return (
      <div className="flex items-center gap-2">
        <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
          {prog && prog.total > 0
            ? `${processed}/${prog.total}${prog.failed > 0 ? ` · ${prog.failed} failed` : ""}`
            : "Calculating…"}
        </span>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        setProg(null);
        startTransition(action);
      }}
    >
      Calculate
    </Button>
  );
}
