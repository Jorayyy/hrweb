import Link from "next/link";
import { getCompany } from "@/lib/settings";
import { LoginForm } from "./form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = (await searchParams) ?? {};
  const company = await getCompany();

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
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
