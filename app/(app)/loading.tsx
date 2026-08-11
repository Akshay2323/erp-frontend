export default function Loading() {
  return (
    <div className="w-full animate-in fade-in space-y-6 duration-200">
      <div className="space-y-2">
        <div className="h-8 w-52 animate-pulse rounded-lg bg-muted/70" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded-lg bg-muted/40" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl border border-border/50 bg-card" />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="h-80 animate-pulse rounded-2xl border border-border/50 bg-card lg:col-span-8" />
        <div className="h-80 animate-pulse rounded-2xl border border-border/50 bg-card lg:col-span-4" />
      </div>
    </div>
  );
}
