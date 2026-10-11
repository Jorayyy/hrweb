import { eq } from "drizzle-orm";
import { db } from "@/db";
import { employee } from "@/db/schema";
import { sessionUser } from "@/lib/auth";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await sessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return new Response("Not found", { status: 404 });

  const [row] = await db
    .select({ photo: employee.photo })
    .from(employee)
    .where(eq(employee.id, id))
    .limit(1);

  const match = row?.photo?.match(/^data:([^;,]+);base64,([\s\S]*)$/);
  if (!match) return new Response("Not found", { status: 404 });

  const body = Buffer.from(match[2], "base64");
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": match[1],
      "Content-Length": String(body.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
