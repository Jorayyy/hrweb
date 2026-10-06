"use client";

import { useEffect, useState } from "react";

export type Job =
  | { kind: "calc"; runId: number }
  | { kind: "dtr"; w: string; f: string; from: number; to: number };

type CalcState = { runStatus: string; total: number; done: number; failed: number };
type DtrState = { approved: number; total: number };

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
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (
      p.kind === "dtr" &&
      typeof p.w === "string" &&
      typeof p.from === "number" &&
      typeof p.to === "number"
    )
      return { kind: "dtr", w: p.w, f: typeof p.f === "string" ? p.f : "", from: p.from, to: p.to };
    if (typeof p.runId === "number") return { kind: "calc", runId: p.runId };
    return null;
  } catch {
    return null;
  }
}

function useJob(): Job | null {
  const [job, setJob] = useState<Job | null>(null);
  useEffect(() => {
    const sync = () => setJob(readJob());
    sync();
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
    };
  }, []);
  return job;
}

function useDoneFlash(done: boolean) {
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(clearJob, 1500);
    return () => clearTimeout(t);
  }, [done]);
}

function JobCard({ title, pct, detail }: { title: string; pct: number; detail: string }) {
  return (
    <div className="fixed right-4 bottom-4 z-50 w-64 rounded-lg border border-border bg-popover p-3 shadow-lg">
      <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
        <span className="font-medium">{title}</span>
        <span className="tabular-nums text-muted-foreground">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs tabular-nums text-muted-foreground">{detail}</p>
    </div>
  );
}

export function JobProgress() {
  const job = useJob();
  if (!job) return null;
  return job.kind === "calc" ? (
    <CalcProgress key={job.runId} runId={job.runId} />
  ) : (
    <DtrProgress key={`${job.w}|${job.f}`} job={job} />
  );
}

function CalcProgress({ runId }: { runId: number }) {
  const [prog, setProg] = useState<CalcState | null>(null);
  const [done, setDone] = useState(false);
  useDoneFlash(done);

  useEffect(() => {
    if (done) return;
    let stopped = false;
    let seen = false;
    const startedAt = Date.now();

    const tick = async () => {
      try {
        const res = await fetch(`/api/payroll/${runId}/progress`, { cache: "no-store" });
        if (!res.ok) {
          if (!stopped) clearJob();
          return;
        }
        const p = (await res.json()) as CalcState;
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
  }, [runId, done]);

  if (!prog) return null;

  const processed = prog.done + prog.failed;
  const pct = done
    ? 100
    : prog.total > 0
      ? Math.min(100, Math.round((processed / prog.total) * 100))
      : 0;
  const stopped = done && prog.runStatus !== "CALCULATED";

  return (
    <JobCard
      title={done ? (stopped ? "Calculation stopped" : "Payroll calculated") : "Calculating payroll"}
      pct={pct}
      detail={
        done
          ? stopped
            ? `Run is ${prog.runStatus.toLowerCase()}`
            : `${prog.total} employee${prog.total === 1 ? "" : "s"} processed`
          : prog.total > 0
            ? `${processed}/${prog.total}${prog.failed > 0 ? ` · ${prog.failed} failed` : ""}`
            : "Preparing…"
      }
    />
  );
}

function DtrProgress({ job }: { job: Extract<Job, { kind: "dtr" }> }) {
  const [prog, setProg] = useState<DtrState | null>(null);
  const [done, setDone] = useState(false);
  const span = Math.max(1, job.to - job.from);
  useDoneFlash(done);

  useEffect(() => {
    if (done) return;
    let stopped = false;
    let lastApproved = -1;
    let lastChange = Date.now();

    const tick = async () => {
      try {
        const res = await fetch(
          `/api/dtr-review/progress?w=${job.w}${job.f ? `&${job.f}` : ""}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          if (!stopped) clearJob();
          return;
        }
        const p = (await res.json()) as DtrState;
        if (stopped) return;
        if (p.approved !== lastApproved) {
          lastApproved = p.approved;
          lastChange = Date.now();
        }
        setProg(p);
        if (p.approved >= job.to) setDone(true);
        else if (Date.now() - lastChange > 8_000) clearJob();
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

  if (!prog) return null;

  const covered = Math.min(span, Math.max(0, prog.approved - job.from));
  const pct = done ? 100 : Math.round((covered / span) * 100);

  return (
    <JobCard
      title={done ? "DTR approved" : "Approving DTR"}
      pct={pct}
      detail={
        done
          ? `${span} employee${span === 1 ? "" : "s"} approved`
          : `${covered}/${span} approved`
      }
    />
  );
}
