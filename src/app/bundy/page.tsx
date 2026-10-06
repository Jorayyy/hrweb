import Link from "next/link";
import { headers } from "next/headers";
import { clientIp, isBundyIpAllowed } from "@/lib/bundy";
import { getCompany } from "@/lib/settings";
import { BundyForm, Clock } from "./form";

export default async function BundyPage() {
  const [allowed, company] = await Promise.all([
    isBundyIpAllowed(clientIp(await headers())),
    getCompany(),
  ]);

  if (!allowed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-center">
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <div className="flex items-center justify-center gap-2.5">
          {company.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logo} alt={company.name} className="size-8 rounded-md object-cover" />
          ) : (
            <div className="flex size-8 items-center justify-center rounded-md bg-white text-xs font-bold text-zinc-900">
              HR
            </div>
          )}
          <div className="text-base font-semibold tracking-wide text-white">{company.name}</div>
        </div>
        <div className="mt-1 text-center text-sm text-zinc-400">Time Clock</div>

        <div className="my-8">
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
