import { and, asc, desc, eq, gte, inArray, lte, sum } from "drizzle-orm";
import { db } from "@/db";
import {
  campaign,
  employee,
  holidayCalendar,
  leaveRequest,
  leaveType,
} from "@/db/schema";
import { requireRole, selfEmployee } from "@/lib/auth";
import { formatDate } from "@/lib/money";
import { manilaDateKey } from "@/lib/time";
import { PageBody, PageHeader } from "@/components/page-header";
import { ReferenceForm } from "@/components/reference-form";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cancelLeave, fileLeave, rejectLeave, approveLeave } from "./actions";

const STAFF = ["OWNER", "ADMIN", "HR"] as const;

function nowKey(): string {
  return manilaDateKey(Date.now());
}

export default async function LeavePage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; ok?: string }>;
}) {
  const user = await requireRole();
  const isStaff = (STAFF as readonly string[]).includes(user.role);
  const params = (await searchParams) ?? {};
  const todayKey = nowKey();
  const year = todayKey.slice(0, 4);

  const types = await db
    .select()
    .from(leaveType)
    .where(eq(leaveType.isActive, true))
    .orderBy(leaveType.code);

  const { employeeId } = await selfEmployee();

  const [used, myRequests, pending, allRequests, activeEmployees, todayHolidays] = await Promise.all([
    employeeId
      ? db
          .select({ typeId: leaveRequest.leaveTypeId, used: sum(leaveRequest.days) })
          .from(leaveRequest)
          .where(
            and(
              eq(leaveRequest.employeeId, employeeId),
              eq(leaveRequest.status, "APPROVED"),
              gte(leaveRequest.dateFrom, `${year}-01-01`),
              lte(leaveRequest.dateTo, `${year}-12-31`),
            ),
          )
          .groupBy(leaveRequest.leaveTypeId)
      : Promise.resolve([]),
    employeeId
      ? db
          .select({
            request: leaveRequest,
            typeName: leaveType.name,
            typeCode: leaveType.code,
            employeeNo: employee.employeeNo,
            firstName: employee.firstName,
            lastName: employee.lastName,
          })
          .from(leaveRequest)
          .innerJoin(leaveType, eq(leaveRequest.leaveTypeId, leaveType.id))
          .innerJoin(employee, eq(leaveRequest.employeeId, employee.id))
          .where(eq(leaveRequest.employeeId, employeeId))
          .orderBy(desc(leaveRequest.filedAt))
          .limit(30)
      : Promise.resolve([]),
    isStaff
      ? db
          .select({
            request: leaveRequest,
            typeName: leaveType.name,
            typeCode: leaveType.code,
            isPaid: leaveType.isPaid,
            employeeNo: employee.employeeNo,
            firstName: employee.firstName,
            lastName: employee.lastName,
            campaignName: campaign.name,
          })
          .from(leaveRequest)
          .innerJoin(leaveType, eq(leaveRequest.leaveTypeId, leaveType.id))
          .innerJoin(employee, eq(leaveRequest.employeeId, employee.id))
          .leftJoin(campaign, eq(employee.campaignId, campaign.id))
          .where(eq(leaveRequest.status, "PENDING"))
          .orderBy(asc(leaveRequest.filedAt))
      : Promise.resolve([]),
    isStaff
      ? db
          .select({
            request: leaveRequest,
            typeName: leaveType.name,
            typeCode: leaveType.code,
            employeeNo: employee.employeeNo,
            firstName: employee.firstName,
            lastName: employee.lastName,
          })
          .from(leaveRequest)
          .innerJoin(leaveType, eq(leaveRequest.leaveTypeId, leaveType.id))
          .innerJoin(employee, eq(leaveRequest.employeeId, employee.id))
          .orderBy(desc(leaveRequest.filedAt))
          .limit(50)
      : Promise.resolve([]),
    isStaff
      ? db
          .select({ id: employee.id, employeeNo: employee.employeeNo, firstName: employee.firstName, lastName: employee.lastName })
          .from(employee)
          .where(inArray(employee.status, ["ACTIVE", "ON_LEAVE"]))
          .orderBy(employee.lastName, employee.firstName)
      : Promise.resolve([]),
    db
      .select({ d: holidayCalendar.holidayDate, name: holidayCalendar.name })
      .from(holidayCalendar)
      .where(eq(holidayCalendar.holidayDate, todayKey)),
  ]);

  const usedByType = new Map(used.map((r) => [r.typeId, Number(r.used ?? 0)]));
  const todayHoliday = todayHolidays[0]?.name ?? null;

  return (
    <>
      <PageHeader
        title="Leaves"
        description={
          isStaff
            ? "File, review and track vacation and sick leave."
            : "Your leave balance and requests."
        }
      />

      <PageBody>
        {params.error ? (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {params.error}
          </div>
        ) : null}
        {params.ok ? (
          <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
            {params.ok}
          </div>
        ) : null}

        {employeeId ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {types.map((t) => {
              const usedDays = usedByType.get(t.id) ?? 0;
              const remaining = Math.max(0, Number(t.annualDays) - usedDays);
              return (
                <Card key={t.id}>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-bold">
                        {t.code}
                      </span>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">{t.name}</p>
                        <p className="text-[11px] text-muted-foreground">{t.isPaid ? "Paid" : "Unpaid (LWP)"}</p>
                      </div>
                    </div>
                    <p className="mt-2.5 text-2xl font-semibold tracking-tight tabular-nums">
                      {remaining.toFixed(1)}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        of {Number(t.annualDays).toFixed(1)} days left
                      </span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {usedDays.toFixed(1)} used in {year} · approved requests only
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : isStaff ? null : (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              No employee profile linked to this account — see HR.
            </CardContent>
          </Card>
        )}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>File a leave</CardTitle>
          </CardHeader>
          <ReferenceForm
            action={fileLeave}
            fields={[
              ...(isStaff && activeEmployees.length > 0
                ? [
                    {
                      name: "employeeId",
                      label: "Employee",
                      type: "select" as const,
                      required: true,
                      options: activeEmployees.map((e) => ({
                        value: String(e.id),
                        label: `${e.lastName}, ${e.firstName} — ${e.employeeNo}`,
                      })),
                    },
                  ]
                : []),
              {
                name: "leaveTypeId",
                label: "Leave type",
                type: "select" as const,
                required: true,
                options: types.map((t) => ({ value: String(t.id), label: `${t.code} — ${t.name}` })),
              },
              { name: "dateFrom", label: "From", type: "date" as const, required: true },
              { name: "dateTo", label: "To", type: "date" as const, required: true },
              {
                name: "reason",
                label: "Reason",
                type: "textarea" as const,
                required: true,
                placeholder: "Family matter, medical appointment…",
              },
            ]}
            submitLabel="File request"
          />
        </Card>

        {isStaff ? (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Pending approval ({pending.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {pending.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nothing waiting — all caught up.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead className="text-right">Days</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Filed</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pending.map(({ request, typeCode, typeName, isPaid, employeeNo, firstName, lastName, campaignName }) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          <span className="block font-medium">
                            {lastName}, {firstName}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {employeeNo}
                            {campaignName ? ` · ${campaignName}` : ""}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={isPaid ? "secondary" : "outline"}>{typeCode}</Badge>
                          <span className="ml-1 text-xs text-muted-foreground">{typeName}</span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums text-sm">
                          {formatDate(request.dateFrom)} – {formatDate(request.dateTo)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{Number(request.days)}</TableCell>
                        <TableCell className="max-w-48 truncate text-sm text-muted-foreground" title={request.reason}>
                          {request.reason}
                        </TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums text-xs text-muted-foreground">
                          {formatDate(manilaDateKey(request.filedAt.getTime()))}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          <form action={approveLeave} className="inline">
                            <input type="hidden" name="id" value={request.id} />
                            <SubmitButton size="sm">Approve</SubmitButton>
                          </form>{" "}
                          <form action={rejectLeave} className="inline">
                            <input type="hidden" name="id" value={request.id} />
                            <SubmitButton variant="outline" size="sm" className="text-destructive">
                              Reject
                            </SubmitButton>
                          </form>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                Approving marks each working day (rest days and holidays excluded) as {""}
                <span className="font-medium">Leave</span> in the DTR — payroll pays those days at
                the regular rate. Days that already have punches or an approved week are skipped.
                Unpaid types post as Leave Without Pay (LWP).
                {todayHoliday ? ` Today is a holiday: ${todayHoliday}.` : ""}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {(isStaff || myRequests.length > 0) && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>{isStaff ? "All requests" : "My requests"}</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const rows = isStaff ? allRequests : myRequests;
                if (rows.length === 0) {
                  return (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No leave requests yet.
                    </p>
                  );
                }
                return (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {isStaff ? <TableHead>Employee</TableHead> : null}
                        <TableHead>Type</TableHead>
                        <TableHead>Dates</TableHead>
                        <TableHead className="text-right">Days</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reviewed</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => {
                        const r = row.request;
                        const canCancel = isStaff
                          ? r.status === "PENDING" || r.status === "APPROVED"
                          : r.status === "PENDING" && r.filedBy === user.id;
                        return (
                          <TableRow key={r.id}>
                            {isStaff ? (
                              <TableCell className="whitespace-nowrap">
                                {row.lastName}, {row.firstName}
                                <span className="block text-xs text-muted-foreground">
                                  {row.employeeNo}
                                </span>
                              </TableCell>
                            ) : null}
                            <TableCell>
                              <Badge variant="outline">{row.typeCode}</Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap tabular-nums text-sm">
                              {formatDate(r.dateFrom)} – {formatDate(r.dateTo)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{Number(r.days)}</TableCell>
                            <TableCell>
                              <StatusBadge status={r.status} />
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {r.reviewedAt
                                ? formatDate(manilaDateKey(r.reviewedAt.getTime()))
                                : "—"}
                              {r.reviewNote ? (
                                <span className="block max-w-40 truncate" title={r.reviewNote}>
                                  {r.reviewNote}
                                </span>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-right">
                              {canCancel ? (
                                <form action={cancelLeave}>
                                  <input type="hidden" name="id" value={r.id} />
                                  <SubmitButton variant="ghost" size="sm" className="text-destructive">
                                    Cancel
                                  </SubmitButton>
                                </form>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                );
              })()}
            </CardContent>
          </Card>
        )}
      </PageBody>
    </>
  );
}
