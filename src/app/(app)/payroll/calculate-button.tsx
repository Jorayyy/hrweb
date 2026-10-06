"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { registerJob } from "@/components/job-progress";
import { Button } from "@/components/ui/button";

export function CalculateButton({
  action,
  runId,
}: {
  action: () => Promise<void>;
  runId: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        registerJob({ kind: "calc", runId });
        startTransition(async () => {
          await action();
          router.refresh();
        });
      }}
    >
      {pending ? "Calculating…" : "Calculate"}
    </Button>
  );
}
