import { cn } from "cn";

const controlCx =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm";

export const inputCx = controlCx;
export const selectCx = cn(controlCx, "cursor-pointer appearance-none bg-background");

export function Field({
  label,
  name,
  error,
  className,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={name} className={cn("grid gap-1.5", className)}>
      <span className="text-sm font-medium leading-none">{label}</span>
      {children}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </label>
  );
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border pt-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {description ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}
