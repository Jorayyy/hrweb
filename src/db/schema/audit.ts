import { bigint, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./org";

/**
 * Generic append-only audit trail. Best-effort writes (see lib/audit.ts) —
 * a failed audit insert must never block the business action.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    actorId: text("actor_id").references(() => users.id),
    /** Denormalized so the log stays readable if the account is deleted. */
    actorEmail: text("actor_email"),
    /** Dotted verb, e.g. "login.success", "employee.update", "settings.save". */
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    detail: jsonb("detail").$type<Record<string, unknown> | null>(),
  },
  (t) => [index("ix_audit_log_at").on(t.at), index("ix_audit_log_actor").on(t.actorId)],
);
