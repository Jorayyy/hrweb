import { desc, sql } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { PageBody, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 50;

const ACTIONS = [
  { value: "", label: "All actions" },
  { value: "login.", label: "Logins" },
  { value: "employee.", label: "Employees" },
  { value: "settings.", label: "Settings" },
  { value: "user.", label: "Users" },
] as const;

function formatAt(value: Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(value);
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; action?: string }>;
}) {
  await requireRole("ADMIN");

  const sp = (await searchParams) ?? {};
  const action = (sp.action ?? "").trim();
  const like = action ? sql`${auditLog.action} LIKE ${action + "%"}` : undefined;

  const [{ n: total }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(auditLog)
    .where(like);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(sp.page) || 1), pages);

  const rows = await db
    .select()
    .from(auditLog)
    .where(like)
    .orderBy(desc(auditLog.at))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const qs = (p: number, a: string) =>
    `/settings/audit?${new URLSearchParams({ ...(a ? { action: a } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`;

  return (
    <>
      <PageHeader title="Audit log" description="Logins, employee changes and settings edits">
        <div className="flex items-center gap-1">
          {ACTIONS.map((a) => (
            <Button
              key={a.value}
              asChild
              variant={action === a.value ? "secondary" : "ghost"}
              size="sm"
            >
              <Link href={qs(1, a.value)}>{a.label}</Link>
            </Button>
          ))}
        </div>
      </PageHeader>

      <PageBody>
        <Card>
          <CardContent>
            {rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No audit entries.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-muted-foreground">{formatAt(r.at)}</TableCell>
                      <TableCell>{r.actorEmail ?? "system"}</TableCell>
                      <TableCell>
                        <code className="text-xs">{r.action}</code>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.entityType ? `${r.entityType}${r.entityId ? ` #${r.entityId}` : ""}` : "—"}
                      </TableCell>
                      <TableCell className="max-w-md">
                        {r.detail ? (
                          <details>
                            <summary className="cursor-pointer text-xs text-muted-foreground select-none">
                              View
                            </summary>
                            <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 text-[11px] whitespace-pre-wrap">
                              {JSON.stringify(r.detail, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {pages > 1 ? (
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
                <span className="text-muted-foreground">
                  Page {page} of {pages} · {total} entries
                </span>
                <div className="flex gap-2">
                  {page > 1 ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={qs(page - 1, action)}>Previous</Link>
                    </Button>
                  ) : null}
                  {page < pages ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={qs(page + 1, action)}>Next</Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
