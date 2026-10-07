import { inArray, type SQL } from "drizzle-orm";
import { employee, type RunScope } from "@/db/schema";

const WEEKLY_FAMILY = ["WEEKLY", "DAILY"] as const;
const SEMI_FAMILY = ["SEMI_MONTHLY", "MONTHLY"] as const;

/** Pay frequencies covered by a cutoff of this frequency. */
export function payFamilyFor(frequency: string) {
  return frequency === "WEEKLY" ? WEEKLY_FAMILY : SEMI_FAMILY;
}

export function hasScope(scope: RunScope | null | undefined): scope is RunScope {
  return Boolean(
    scope && (scope.campaignIds?.length || scope.departmentIds?.length || scope.costCenterIds?.length),
  );
}

/**
 * The single definition of "who belongs to this run": active employees on the
 * cutoff's pay family, narrowed by the run's scope. Every roster query for a
 * run must go through here so scope can never be forgotten.
 */
export function runEmployeeConditions(
  frequency: string,
  scope: RunScope | null | undefined,
): SQL[] {
  const conds: SQL[] = [
    inArray(employee.status, ["ACTIVE", "ON_LEAVE"]),
    inArray(employee.payFrequency, payFamilyFor(frequency)),
  ];
  if (scope?.campaignIds?.length) conds.push(inArray(employee.campaignId, scope.campaignIds));
  if (scope?.departmentIds?.length) conds.push(inArray(employee.departmentId, scope.departmentIds));
  if (scope?.costCenterIds?.length) conds.push(inArray(employee.costCenterId, scope.costCenterIds));
  return conds;
}

/** Human summary of a scope by dimension counts, e.g. "2 campaign(s) · 1 department(s)". */
export function scopeLabel(scope: RunScope): string {
  return [
    scope.campaignIds?.length ? `${scope.campaignIds.length} campaign(s)` : null,
    scope.departmentIds?.length ? `${scope.departmentIds.length} department(s)` : null,
    scope.costCenterIds?.length ? `${scope.costCenterIds.length} cost center(s)` : null,
  ]
    .filter((x): x is string => x !== null)
    .join(" · ");
}

/** Whitelists the multi-select arrays posted by the new-run form. */
export function parseRunScope(formData: FormData): RunScope | null {
  const ids = (name: string): number[] =>
    formData
      .getAll(name)
      .map((v) => Number(v))
      .filter((n) => Number.isInteger(n) && n > 0);

  const scope: RunScope = {};
  const campaignIds = ids("campaignIds");
  const departmentIds = ids("departmentIds");
  const costCenterIds = ids("costCenterIds");
  if (campaignIds.length) scope.campaignIds = campaignIds;
  if (departmentIds.length) scope.departmentIds = departmentIds;
  if (costCenterIds.length) scope.costCenterIds = costCenterIds;
  return hasScope(scope) ? scope : null;
}
