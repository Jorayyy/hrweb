import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { payrollJob, payrollRun } from "@/db/schema";
import { auth } from "@/lib/auth";

export async function GET(_req: Request, ctx: { params: Promise<{ runId: string }> }) {
  const user = (await auth())?.user;
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "ADMIN" && user.role !== "PAYROLL")
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const runId = Number((await ctx.params).runId);
  if (!Number.isInteger(runId)) return Response.json({ error: "Bad request" }, { status: 400 });

  const [run] = await db
    .select({ status: payrollRun.status })
    .from(payrollRun)
    .where(eq(payrollRun.id, runId))
    .limit(1);
  if (!run) return Response.json({ error: "Not found" }, { status: 404 });

  const rows = await db
    .select({ status: payrollJob.status, n: count() })
    .from(payrollJob)
    .where(eq(payrollJob.runId, runId))
    .groupBy(payrollJob.status);

  let total = 0;
  let done = 0;
  let failed = 0;
  for (const r of rows) {
    total += r.n;
    if (r.status === "DONE") done += r.n;
    if (r.status === "FAILED") failed += r.n;
  }

  return Response.json({ runStatus: run.status, total, done, failed });
}
