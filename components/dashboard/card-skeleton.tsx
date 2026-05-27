export function CardSkeleton() {
  return (
    <div className="rounded-lg border bg-card animate-pulse">
      <div className="px-5 py-3.5 border-b">
        <div className="h-4 w-24 bg-muted rounded" />
      </div>
      <div className="px-5 py-4 space-y-3">
        <div className="h-3 w-full bg-muted rounded" />
        <div className="h-3 w-3/4 bg-muted rounded" />
        <div className="h-3 w-1/2 bg-muted rounded" />
      </div>
    </div>
  );
}
