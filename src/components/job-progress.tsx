"use client";

import { useEffect, useState } from "react";

type Job = { runId: number };
type Progress = { runStatus: string; total: number; done: number; failed: number };

const KEY = "hrweb:payroll-job";
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function registerJob(job: Job) {
  try {
    localStorage.setItem(KEY, JSON.stringify(job));
    notify();
  } catch {
    // storage unavailable — pill just won't show
  }
}

function clearJob() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  notify();
}

function readJob(): Job | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Job>;
    return typeof parsed.runId === "number" ? { runId: parsed.runId } : null;
  } catch {
    return null;
  }
}

export function JobProgress() {
  const [job, setJob] = useState<Job | null>(null);
  const [prog, setProg] = useState<Progress | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const sync = () => {
      setJob(readJob());
      setProg(null);
      setDone(false);
    };
    sync();
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
    };
  }, []);

  useEffect(() => {
    if (!job || done) return;
    let stopped = false;
    let seen = false;
    const startedAt = Date.now();

    const tick = async () => {
      try {
        const res = await fetch(`/api/payroll/${job.runId}/progress`, { cache: "no-store" });
        if (!res.ok) {
          if (!stopped) clearJob();
          return;
        }
        const p = (await res.json()) as Progress;
        if (stopped) return;
        if (p.total > 0) seen = true;
        setProg(p);
        if ((seen && p.runStatus !== "CALCULATING") || (!seen && Date.now() - startedAt > 20_000))
          setDone(true);
      } catch {
        // transient network error — keep polling
      }
    };

    tick();
    const timer = setInterval(tick, 500);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [job, done]);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(clearJob, 1500);
    return () => clearTimeout(t);
  }, [done]);

  if (!job || !prog) return null;

  const processed = prog.done + prog.failed;
  const pct = done
    ? 100
    : prog.total > 0
      ? Math.min(100, Math.round((processed / prog.total) * 100))
      : 0;
  const settled = done && prog.runStatus !== "CALCULATED";

  return (
    <div className="fixed right-4 bottom-4 z-50 w-64 rounded-lg border border-border bg-popover p-3 shadow-lg">
      <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
        <span className="font-medium">
          {done ? (settled ? "Calculation stopped" : "Payroll calculated") : "Calculating payroll"}
        </span>
        <span className="tabular-nums text-muted-foreground">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs tabular-nums text-muted-foreground">
        {done
          ? settled
            ? `Run is ${prog.runStatus.toLowerCase()}`
            : `${prog.total} employee${prog.total === 1 ? "" : "s"} processed`
          : prog.total > 0
            ? `${processed}/${prog.total}`
            : "Preparing…"}
        {!done && prog.failed > 0 ? ` · ${prog.failed} failed` : ""}
      </p>
    </div>
  );
}
