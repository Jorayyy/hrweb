import { Loader2Icon } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}
