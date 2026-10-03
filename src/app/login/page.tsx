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
      </div>
    </div>
  );
}
