import { cn } from "cn";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function PageHeaderSkeleton({
  actions = 1,
  back = false,
  desc = true,
}: {
  actions?: number;
  back?: boolean;
  desc?: boolean;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-14 items-center justify-between gap-4 px-6">
        <div className="flex min-w-0 items-center gap-2">
          {back ? <Skeleton className="size-7 rounded-lg" /> : null}
          <div className="min-w-0 space-y-1.5">
            <Skeleton className="h-4 w-40" />
            {desc ? <Skeleton className="h-2.5 w-56" /> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {Array.from({ length: actions }, (_, i) => (
            <Skeleton key={i} className="h-7 w-20 rounded-lg" />
          ))}
        </div>
      </div>
    </header>
  );
}

const CELL_WIDTHS = ["max-w-28", "max-w-40", "max-w-20", "max-w-32", "max-w-24", "max-w-36"];

export function TableSkeleton({
  rows = 6,
  cols = 5,
  title = true,
  toolbar = false,
  className,
}: {
  rows?: number;
  cols?: number;
  title?: boolean;
  toolbar?: boolean;
  className?: string;
}) {
  return (
    <Card className={className}>
      {title ? (
        <CardHeader>
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-2.5 w-64" />
        </CardHeader>
      ) : null}
      <CardContent>
        {toolbar ? <FilterBarSkeleton className="mb-4" /> : null}
        <div className="space-y-3">
          <div className="flex items-center gap-4 border-b pb-2">
            {Array.from({ length: cols }, (_, c) => (
              <Skeleton key={c} className="h-3 flex-1" />
            ))}
          </div>
          {Array.from({ length: rows }, (_, r) => (
            <div key={r} className="flex items-center gap-4">
              {Array.from({ length: cols }, (_, c) => (
                <Skeleton
                  key={c}
                  className={`h-3.5 flex-1 ${CELL_WIDTHS[(r + c) % CELL_WIDTHS.length]}`}
                />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function FilterBarSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-8 w-20 rounded-lg" />
    </div>
  );
}

export function FormSkeleton({
  fields = 4,
  grid = false,
  title = false,
  footer = true,
  className,
}: {
  fields?: number;
  grid?: boolean;
  title?: boolean;
  footer?: boolean;
  className?: string;
}) {
  return (
    <Card className={className}>
      {title ? (
        <CardHeader>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-2.5 w-60" />
        </CardHeader>
      ) : null}
      <CardContent className="space-y-4">
        <div className={cn(grid ? "grid gap-4 sm:grid-cols-2" : "space-y-4")}>
          {Array.from({ length: fields }, (_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
        {footer ? (
          <div className="flex justify-end border-t border-border pt-4">
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function PanelSkeleton({ rows = 5, title = true, className }: { rows?: number; title?: boolean; className?: string }) {
  return (
    <Card className={className}>
      {title ? (
        <CardHeader>
          <Skeleton className="h-4 w-36" />
        </CardHeader>
      ) : null}
      <CardContent className="space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-7 shrink-0 rounded-full" />
            <Skeleton className="h-3.5 flex-1" />
            <Skeleton className="h-3.5 w-16" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function CardsSkeleton({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4", className ?? "sm:grid-cols-2 lg:grid-cols-4")}>
      {Array.from({ length: count }, (_, i) => (
        <Card key={i}>
          <CardContent className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-28" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
