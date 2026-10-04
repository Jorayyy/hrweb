import Link from "next/link";
import { LoginForm } from "./form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = (await searchParams) ?? {};

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-lg font-semibold tracking-wide text-white">BPO-HRWeb</div>
        <p className="mt-1 text-sm text-zinc-400">Sign in to continue</p>
        <LoginForm callbackUrl={callbackUrl} />
        <Link
          href="/bundy"
          className="mt-4 block rounded-lg border border-zinc-800 px-4 py-2.5 text-center text-sm text-zinc-300 hover:bg-zinc-900"
        >
          Time clock
        </Link>
      </div>
    </div>
  );
}
