export default function Loading() {
  return (
    <div className="container py-6 md:py-8 px-4 animate-pulse">
      <div className="h-7 w-40 bg-muted rounded mb-6" />
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-4 w-full bg-muted rounded" />
          <div className="h-4 w-3/4 bg-muted rounded" />
          <div className="h-4 w-5/6 bg-muted rounded" />
        </div>
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-4 w-full bg-muted rounded" />
          <div className="h-4 w-3/4 bg-muted rounded" />
          <div className="h-4 w-5/6 bg-muted rounded" />
        </div>
      </div>
    </div>
  );
}
