"use client";

import * as React from "react";
import { Loader2Icon } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function SubmitButton({
  children,
  disabled,
  ...props
}: React.ComponentProps<typeof Button>) {
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
    <Button {...props} type="submit" disabled={pending || disabled}>
      {pending && slow ? <Loader2Icon className="animate-spin" /> : null}
      {children}
    </Button>
  );
}
