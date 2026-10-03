import { Badge } from "@/components/ui/badge";

const VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  ACTIVE: "default",
  PREBOARDING: "secondary",
  ON_LEAVE: "secondary",
  REINSTATED: "secondary",
  SUSPENDED: "outline",
  RETIRED: "outline",
  AWOL: "destructive",
  TERMINATED: "destructive",
};

export function humanize(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={VARIANTS[status] ?? "secondary"}>{humanize(status)}</Badge>;
}
