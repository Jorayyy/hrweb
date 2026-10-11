import { db } from "@/db";
import { auditLog } from "@/db/schema";

export type AuditEntry = {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType?: string;
  entityId?: string | number;
  detail?: Record<string, unknown> | null;
};

/** Append-only, best-effort: an audit failure is logged but never blocks the action. */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLog).values({
      actorId: entry.actorId ?? null,
      actorEmail: entry.actorEmail ?? null,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId != null ? String(entry.entityId) : null,
      detail: entry.detail ?? null,
    });
  } catch (error) {
    console.error(`audit_log write failed (${entry.action}):`, error);
  }
}
