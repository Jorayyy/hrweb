import Link from "next/link";
import { LoginForm } from "./form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = (await searchParams) ?? {};

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 px-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 size-[32rem] rounded-full bg-emerald-600/15 blur-3xl" />
        <div className="absolute -bottom-48 right-[-10rem] size-[36rem] rounded-full bg-sky-600/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(9,9,11,0.55)_100%)]" />
      </div>

      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-white text-xs font-bold text-zinc-900">
            HR
          </div>
          <div className="text-base font-semibold tracking-wide text-white">BPO-HRWeb</div>
        </div>

        <p className="mt-1 text-sm text-zinc-400">Sign in to continue</p>

        <LoginForm callbackUrl={callbackUrl} />

        <Link
          href="/bundy"
          className="mt-4 block rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-center text-sm text-zinc-300 backdrop-blur transition-colors hover:bg-white/10"
        >
          Time clock
        </Link>
      </div>
    </div>
  );
}
