import { Loader2Icon } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <Loader2Icon className="size-5 animate-spin text-zinc-500" />
    </div>
  );
}
