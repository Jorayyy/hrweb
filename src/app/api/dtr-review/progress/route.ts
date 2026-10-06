import { and, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { attendanceDay, employee } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  addDays,
  mondayOf,
  matchFilteredEmployee,
  parseDtrFilter,
  requiredDates,
  weekReadiness,
} from "@/lib/attendance/review";
import { isIsoDate } from "@/lib/form";
import { manilaDateKey } from "@/lib/time";

export async function GET(req: Request) {
  const user = (await auth())?.user;
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "ADMIN" && user.role !== "HR")
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const w = url.searchParams.get("w") ?? "";
  if (!isIsoDate(w) || mondayOf(w) !== w)
    return Response.json({ error: "Bad request" }, { status: 400 });
  const to = addDays(w, 6);
  const fl = parseDtrFilter(url.searchParams.toString());

  const [emps, rows] = await Promise.all([
    db
      .select({
        id: employee.id,
        employeeNo: employee.employeeNo,
        firstName: employee.firstName,
        lastName: employee.lastName,
        dateHired: employee.dateHired,
        weeklyRestDays: employee.weeklyRestDays,
        campaignId: employee.campaignId,
        departmentId: employee.departmentId,
      })
      .from(employee)
      .where(inArray(employee.status, ["ACTIVE", "ON_LEAVE"])),
    db
      .select()
      .from(attendanceDay)
      .where(and(gte(attendanceDay.workDate, w), lte(attendanceDay.workDate, to))),
  ]);

  const byEmp = new Map<number, typeof rows>();
  for (const row of rows) {
    const list = byEmp.get(row.employeeId);
    if (list) list.push(row);
    else byEmp.set(row.employeeId, [row]);
  }

  let approved = 0;
  let total = 0;
  for (const emp of emps) {
    if (!matchFilteredEmployee(fl, emp)) continue;
    total += 1;
    const required = requiredDates({
      from: w,
      to,
      dateHired: emp.dateHired,
      weeklyRestDays: emp.weeklyRestDays,
    });
    if (weekReadiness(required, byEmp.get(emp.id) ?? [], manilaDateKey(Date.now())).approved)
      approved += 1;
  }

  return Response.json({ approved, total });
}
