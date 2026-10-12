import Link from "next/link";
import { Fragment } from "react";
import { and, count, desc, eq, sum } from "drizzle-orm";
import { CircleCheckIcon, OctagonXIcon, TriangleAlertIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { db } from "@/db";
import {
  campaign,
  costCenter,
  department,
  employee,
  payrollPeriod,
  payrollRun,
  payrollRunItem,
  type RunScope,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import {
  employeeFilterConditions,
  encodeDtrFilter,
  hasEmployeeFilter,
  parseDtrFilter,
} from "@/lib/attendance/review";
import { formatDate, formatPhp } from "@/lib/money";
import { EmployeeFilters } from "@/components/employee-filters";
import { PageBody, PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CalculateButton } from "../../calculate-button";
import { calculateRun, createRun, deletePeriod, transitionRun } from "../../actions";
import { periodReadiness, type Check } from "../../readiness";
import { NewRun } from "./new-run";
import { RegisterTable, type RegisterGroup } from "./register-table";

const PAGE_SIZE = 25;

const STEP_LABELS = ["Open", "Calculated", "Approved", "Posted"] as const;

function stageOf(status: string): number {
  switch (status) {
    case "OPEN":
    case "CUT_OFF":
      return 0;
    case "CALCULATING":
    case "CALCULATED":
    case "REVIEW":
      return 1;
    case "APPROVED":
      return 2;
    case "POSTED":
      return 3;
    default:
      return -1;
  }
}

type Opt = { id: number; name: string };

function CheckIcon({ check }: { check: Check }) {
  if (check.ok) return <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600" />;
  if (check.blocking) return <OctagonXIcon className="mt-0.5 size-4 shrink-0 text-destructive" />;
  return <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />;
}

/** Scope rendered with option names, e.g. "Telus Support · Workforce Management". */
function scopeText(scope: RunScope | null, opts: { campaigns: Opt[]; departments: Opt[]; costCenters: Opt[] }): string | null {
  if (!scope) return null;
  const names = (ids: number[] | undefined, list: Opt[]): string[] | null =>
    ids?.length ? ids.map((id) => list.find((o) => o.id === id)?.name ?? `#${id}`) : null;
  const parts = [
    names(scope.campaignIds, opts.campaigns),
    names(scope.departmentIds, opts.departments),
    names(scope.costCenterIds, opts.costCenters),
  ].filter((x): x is string[] => x !== null);
  return parts.length > 0 ? parts.map((p) => p.join(", ")).join(" · ") : null;
}

export default async function PayrollPeriodPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    run?: string;
    page?: string;
    error?: string;
    warn?: string;
    campaign?: string;
    dept?: string;
    cc?: string;
  }>;
}) {
  await requireRole("ADMIN", "PAYROLL");

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();

  const sp = (await searchParams) ?? {};
  const error = (sp.error ?? "").trim();
  const warn = (sp.warn ?? "").trim();
  const filter = parseDtrFilter(sp);
  const filterQS = encodeDtrFilter(filter);
  const filterActive = hasEmployeeFilter(filter);
  const filterConds = employeeFilterConditions(filter);

  const [period] = await db
    .select()
    .from(payrollPeriod)
    .where(eq(payrollPeriod.id, id))
    .limit(1);
  if (!period) notFound();

  const runs = await db
    .select()
    .from(payrollRun)
    .where(eq(payrollRun.periodId, id))
    .orderBy(desc(payrollRun.runNo));
  const run =
    runs.find((r) => r.id === Number(sp.run)) ??
    runs.find((r) => r.status !== "VOID") ??
    runs[0] ??
    null;

  const readiness = await periodReadiness(id, run?.id);
  const ready = readiness.ready;
  const blocking = readiness.checks.filter((c) => c.blocking && !c.ok);

  const itemConds = run ? [eq(payrollRunItem.runId, run.id), ...filterConds] : [];

  const totalItems = run
    ? (
        await db
          .select({ n: count() })
          .from(payrollRunItem)
          .leftJoin(employee, eq(payrollRunItem.employeeId, employee.id))
          .where(and(...itemConds))
      )[0].n
    : 0;
  const pages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(sp.page) || 1), pages);

  const items =
    run
      ? await db
          .select({
            item: payrollRunItem,
            firstName: employee.firstName,
            lastName: employee.lastName,
            employeeNo: employee.employeeNo,
            campaignId: employee.campaignId,
            campaignName: campaign.name,
          })
          .from(payrollRunItem)
          .leftJoin(employee, eq(payrollRunItem.employeeId, employee.id))
          .leftJoin(campaign, eq(employee.campaignId, campaign.id))
          .where(and(...itemConds))
          .orderBy(employee.lastName, employee.firstName)
          .limit(PAGE_SIZE)
          .offset((page - 1) * PAGE_SIZE)
      : [];

  const groupTotals: {
    campaignId: number | null;
    name: string | null;
    n: number;
    gross: string | null;
    ded: string | null;
    net: string | null;
  }[] =
    run
      ? await db
          .select({
            campaignId: employee.campaignId,
            name: campaign.name,
            n: count(),
            gross: sum(payrollRunItem.grossPay),
            ded: sum(payrollRunItem.totalDeductions),
            net: sum(payrollRunItem.netPay),
          })
          .from(payrollRunItem)
          .leftJoin(employee, eq(payrollRunItem.employeeId, employee.id))
          .leftJoin(campaign, eq(employee.campaignId, campaign.id))
          .where(and(...itemConds))
          .groupBy(employee.campaignId, campaign.name)
      : [];

  const filteredTotals =
    run && filterActive
      ? (
          await db
            .select({
              n: count(),
              gross: sum(payrollRunItem.grossPay),
              ded: sum(payrollRunItem.totalDeductions),
              net: sum(payrollRunItem.netPay),
            })
            .from(payrollRunItem)
            .leftJoin(employee, eq(payrollRunItem.employeeId, employee.id))
            .where(and(...itemConds))
        )[0]
      : null;

  const [campaigns, departments, costCenters] = await Promise.all([
    db.select({ id: campaign.id, name: campaign.name }).from(campaign).orderBy(campaign.name),
    db.select({ id: department.id, name: department.name }).from(department).orderBy(department.name),
    db.select({ id: costCenter.id, name: costCenter.name }).from(costCenter).orderBy(costCenter.name),
  ]);
  const opts = { campaigns, departments, costCenters };

  const registerHref = (target: number) =>
    `/payroll/periods/${id}?run=${run?.id ?? ""}&page=${target}${filterQS ? `&${filterQS}` : ""}`;

  const footer =
    filterActive && filteredTotals
      ? {
          label: `Filtered subtotal · ${filteredTotals.n} row${filteredTotals.n === 1 ? "" : "s"}`,
          gross: formatPhp(Number(filteredTotals.gross ?? 0)),
          ded: formatPhp(Number(filteredTotals.ded ?? 0)),
          net: formatPhp(Number(filteredTotals.net ?? 0)),
        }
      : run
        ? {
            label: "Run totals",
            gross: formatPhp(run.grossTotal ?? 0),
            ded: formatPhp(run.deductionTotal ?? 0),
            net: formatPhp(run.netTotal ?? 0),
          }
        : null;

  const registerRows = items.map((r) => {
    const otHours =
      r.item.hoursOtOrd +
      r.item.hoursOtRd +
      r.item.hoursOtSpecl +
      r.item.hoursOtRh +
      r.item.hoursOtRhRd;
    return {
      employeeId: r.item.employeeId,
      campaignId: r.campaignId ?? 0,
      name: `${r.lastName}, ${r.firstName}`,
      employeeNo: r.employeeNo ?? "",
      days: r.item.daysWorked,
      abs: r.item.daysAbsent,
      ot: otHours > 0 ? otHours.toFixed(2) : "—",
      nsd: r.item.hoursNsd > 0 ? r.item.hoursNsd.toFixed(2) : "—",
      gross: formatPhp(r.item.grossPay),
      ded: formatPhp(r.item.totalDeductions),
      net: formatPhp(r.item.netPay),
    };
  });

  const registerGroups: RegisterGroup[] = groupTotals
    .slice()
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
    .map((g) => ({
      campaignId: g.campaignId ?? 0,
      name: g.name ?? "Unassigned",
      n: g.n,
      gross: formatPhp(Number(g.gross ?? 0)),
      ded: formatPhp(Number(g.ded ?? 0)),
      net: formatPhp(Number(g.net ?? 0)),
    }));

  return (
    <>
      <PageHeader
        title={period.periodCode}
        description={`${formatDate(period.dateFrom)} – ${formatDate(period.dateTo)} · pay date ${formatDate(period.payDate)} · ${period.frequency.toLowerCase()}`}
      >
        <div className="flex items-center gap-2">
          {run ? <StatusBadge status={run.status} /> : null}
          <Button asChild variant="outline" size="sm">
            <Link href="/payroll">All periods</Link>
          </Button>
          <form action={deletePeriod.bind(null, id)}>
            <SubmitButton
              variant="destructive"
              size="sm"
              confirmText={`Delete ${period.periodCode} and all of its runs? This cannot be undone.`}
            >
              Delete cutoff
            </SubmitButton>
          </form>
        </div>
      </PageHeader>

      <PageBody>
        {error ? (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <span>{error}</span>
          </div>
        ) : null}
        {warn ? (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            <span>{warn}</span>
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link href="/dtr-review">Open DTR Review</Link>
            </Button>
          </div>
        ) : null}

        <div className="grid gap-4">
          {run ? (
            <Card>
              <CardContent className="grid gap-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">Run #{run.runNo} summary</h2>
                  {scopeText(run.scope, opts) ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {scopeText(run.scope, opts)}
                    </span>
                  ) : null}
                </div>
                <ol className="flex items-center gap-2" data-tour="run-progress">
                  {STEP_LABELS.map((label, i) => {
                    const stage = stageOf(run.status);
                    const done = stage >= 0 && i < stage;
                    const current = stage === i;
                    return (
                      <Fragment key={label}>
                        {i > 0 ? <div className="h-px flex-1 bg-border" /> : null}
                        <li className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                          <span
                            className={[
                              "flex size-4 items-center justify-center rounded-full text-[10px] font-medium",
                              done || current
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground",
                            ].join(" ")}
                          >
                            {i + 1}
                          </span>
                          <span className={current ? "font-medium" : "text-muted-foreground"}>
                            {label}
                          </span>
                        </li>
                      </Fragment>
                    );
                  })}
                </ol>
                <div className="grid gap-3 sm:grid-cols-4">
                  {[
                    { label: "Headcount", value: run.headcount != null ? String(run.headcount) : "—" },
                    { label: "Gross", value: run.grossTotal != null ? formatPhp(run.grossTotal) : "—" },
                    {
                      label: "Deductions",
                      value: run.deductionTotal != null ? formatPhp(run.deductionTotal) : "—",
                    },
                    { label: "Net", value: run.netTotal != null ? formatPhp(run.netTotal) : "—" },
                  ].map((t) => (
                    <div key={t.label} className="grid gap-0.5 rounded-lg border px-3 py-2">
                      <span className="text-xs text-muted-foreground">{t.label}</span>
                      <span className="font-medium tabular-nums">{t.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card data-tour="readiness">
            <CardHeader>
              <CardTitle>Recheck before posting</CardTitle>
              <CardDescription>
                {ready
                  ? "Every blocking check passed — approve, then post to publish payslips."
                  : `${blocking.length} blocking check${blocking.length === 1 ? "" : "s"} must pass before approve or post.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-1">
                {readiness.checks.map((c) => (
                  <li
                    key={c.key}
                    className="flex items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/40"
                  >
                    <CheckIcon check={c} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{c.label}</p>
                      <p className="text-xs text-muted-foreground">{c.detail}</p>
                    </div>
                    {c.ok ? null : (
                      <Badge variant={c.blocking ? "destructive" : "secondary"}>
                        {c.blocking ? "Blocking" : "Warning"}
                      </Badge>
                    )}
                    {c.fix ? (
                      <Button asChild variant="outline" size="sm" className="shrink-0">
                        <Link href={c.fix.href}>{c.fix.text}</Link>
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {runs.length > 0 ? (
            <Card data-tour="runs-table">
              <CardHeader>
                <CardTitle>Runs</CardTitle>
                <CardDescription>
                  New run snapshots the statutory tables in force for this cutoff.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Run</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Headcount</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Deductions</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.map((r) => {
                      const selected = run?.id === r.id;
                      const mutable = r.status !== "POSTED" && r.status !== "VOID";
                      const recalculable = ["OPEN", "CUT_OFF", "CALCULATED", "REVIEW"].includes(
                        r.status,
                      );
                      const scope = scopeText(r.scope, opts);
                      return (
                        <TableRow
                          key={r.id}
                          className={selected ? "bg-muted/50" : undefined}
                        >
                          <TableCell>
                            <a
                              href={`/payroll/periods/${id}?run=${r.id}${filterQS ? `&${filterQS}` : ""}`}
                              className="font-medium hover:underline"
                            >
                              #{r.runNo}
                            </a>
                            <span className="block max-w-44 truncate text-xs text-muted-foreground">
                              {scope ?? "Full roster"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={r.status} />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {r.headcount ?? "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {r.grossTotal != null ? formatPhp(r.grossTotal) : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {r.deductionTotal != null ? formatPhp(r.deductionTotal) : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {r.netTotal != null ? formatPhp(r.netTotal) : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {selected && recalculable ? (
                                <CalculateButton
                                  action={calculateRun.bind(null, id, r.id)}
                                  runId={r.id}
                                />
                              ) : null}
                              {selected && ["CALCULATED", "REVIEW"].includes(r.status) ? (
                                <form
                                  action={transitionRun.bind(null, id, r.id, "approve")}
                                >
                                  <SubmitButton
                                    variant="outline"
                                    size="sm"
                                    disabled={!ready}
                                    title={ready ? undefined : "Blocking checks are failing"}
                                  >
                                    Approve
                                  </SubmitButton>
                                </form>
                              ) : null}
                              {selected && r.status === "APPROVED" ? (
                                <form action={transitionRun.bind(null, id, r.id, "post")}>
                                  <SubmitButton
                                    size="sm"
                                    disabled={!ready}
                                    title={ready ? undefined : "Blocking checks are failing"}
                                  >
                                    Post
                                  </SubmitButton>
                                </form>
                              ) : null}
                              {selected && mutable ? (
                                <form
                                  action={transitionRun.bind(null, id, r.id, "void")}
                                >
                                  <SubmitButton variant="ghost" size="sm">
                                    Void
                                  </SubmitButton>
                                </form>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
                  <span className="text-sm text-muted-foreground">
                    {runs.length} run{runs.length === 1 ? "" : "s"} on this cutoff
                  </span>
                  <NewRun
                    action={createRun.bind(null, id)}
                    campaigns={campaigns}
                    departments={departments}
                    costCenters={costCenters}
                  />
                </div>
              </CardContent>
            </Card>
          ) : null}

          {run && period ? (
            <Card data-tour="register">
              <CardHeader>
                <CardTitle>
                  Register — run #{run.runNo}
                </CardTitle>
                <CardDescription>
                  {filterActive ? `${totalItems} matching employee${totalItems === 1 ? "" : "s"}` : `${totalItems} employee${totalItems === 1 ? "" : "s"}`}
                  {" · pay date "}
                  {formatDate(period.payDate)}
                </CardDescription>
                <div className="mt-3">
                  <EmployeeFilters
                    campaigns={campaigns}
                    departments={departments}
                    costCenters={costCenters}
                  />
                </div>
              </CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    {filterActive
                      ? "No register rows match these filters."
                      : "Run has no calculated rows yet — hit Calculate above."}
                  </p>
                ) : (
                  <>
                    <RegisterTable
                      rows={registerRows}
                      groups={registerGroups}
                      footer={footer}
                      runId={run.id}
                    />

                    {pages > 1 ? (
                      <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
                        <span className="text-muted-foreground">
                          Page {page} of {pages} · {totalItems} employees
                        </span>
                        <div className="flex gap-2">
                          {page > 1 ? (
                            <Button asChild variant="outline" size="sm">
                              <a href={registerHref(page - 1)}>Previous</a>
                            </Button>
                          ) : null}
                          {page < pages ? (
                            <Button asChild variant="outline" size="sm">
                              <a href={registerHref(page + 1)}>Next</a>
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </PageBody>
    </>
  );
}
