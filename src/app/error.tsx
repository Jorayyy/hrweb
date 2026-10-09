"use client";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const detail = [error.message, error.digest].filter(Boolean).join(" — ");

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/50">
        <h1 className="text-lg font-semibold text-white">Something went wrong</h1>
        <p className="mt-1 text-sm text-zinc-400">This page hit an unexpected error.</p>

        {detail ? (
          <p className="mt-4 max-h-40 overflow-auto rounded-lg border border-white/10 bg-black/40 p-3 text-xs break-words text-zinc-400">
            {detail}
          </p>
        ) : null}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="flex-1 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-200"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => history.back()}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/10"
          >
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}
