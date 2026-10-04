import Link from "next/link";
import { headers } from "next/headers";
import { clientIp, isBundyIpAllowed } from "@/lib/bundy";
import { BundyForm, Clock } from "./form";

export default async function BundyPage() {
  const allowed = await isBundyIpAllowed(clientIp(await headers()));

  if (!allowed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-center">
        <div className="text-4xl">⛔</div>
        <h1 className="mt-4 text-xl font-semibold text-white">Device not authorized</h1>
        <p className="mt-2 max-w-sm text-sm text-zinc-400">
          This device&apos;s IP address is not registered for punching. Ask HR or the admin to
          register it under Setup → Time clock IPs.
        </p>
        <Link href="/login" className="mt-6 text-sm text-zinc-500 underline hover:text-zinc-300">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-1 text-center text-lg font-semibold tracking-wide text-white">
          BPO-HRWeb
        </div>
        <div className="mb-8 text-center text-sm text-zinc-400">Time Clock</div>

        <div className="mb-8">
          <Clock />
        </div>

        <BundyForm />

        <div className="mt-8 text-center">
          <Link href="/login" className="text-xs text-zinc-600 underline hover:text-zinc-400">
            Staff sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
