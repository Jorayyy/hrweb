"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function BackButton() {
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="-ml-2 shrink-0 text-muted-foreground"
      onClick={() => router.back()}
    >
      <ChevronLeft />
      Back
    </Button>
  );
}
