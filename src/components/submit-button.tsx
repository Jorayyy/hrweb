"use client";

import * as React from "react";
import { Loader2Icon } from "lucide-react";
import { useFormStatus } from "react-dom";
import { registerJob, type Job } from "@/components/job-progress";
import { Button } from "@/components/ui/button";

export function SubmitButton({
  children,
  disabled,
  job,
  onClick,
  confirmText,
  ...props
}: React.ComponentProps<typeof Button> & { job?: Job; confirmText?: string }) {
  const { pending } = useFormStatus();
  const [slow, setSlow] = React.useState(false);

  React.useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => setSlow(true), 1000);
    return () => {
      clearTimeout(t);
      setSlow(false);
    };
  }, [pending]);

  return (
    <Button
      {...props}
      type="submit"
      disabled={pending || disabled}
      onClick={(e) => {
        if (confirmText && !window.confirm(confirmText)) {
          e.preventDefault();
          return;
        }
        if (job) registerJob(job);
        onClick?.(e);
      }}
    >
      {pending && slow ? <Loader2Icon className="animate-spin" /> : null}
      {children}
    </Button>
  );
}
