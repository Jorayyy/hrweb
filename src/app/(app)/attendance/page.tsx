import { requireRole } from "@/lib/auth";

export default async function AttendancePage() {
  await requireRole("ADMIN", "HR");

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <h1 className="text-2xl font-semibold">Attendance</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Biometric punches, shift matching and day assembly.
      </p>
      <div className="mt-8 rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
        Nothing here yet. CSV import lands next.
      </div>
    </div>
  );
}
