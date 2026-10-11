"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { FormState } from "@/lib/form";

export function useActionToast(state: FormState) {
  const seen = useRef(state);

  useEffect(() => {
    if (state === seen.current) return;
    seen.current = state;
    if (state?.message) toast.success(state.message);
    else if (state?.error) toast.error(state.error);
  }, [state]);
}
