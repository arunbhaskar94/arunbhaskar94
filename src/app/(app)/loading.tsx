import { Skeleton } from "@/components/ui/Skeleton";

export default function AppLoading() {
  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4" aria-busy="true">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72 max-w-full" />
      <Skeleton className="h-56 w-full rounded-xl" />
      <div className="flex gap-3">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
      <span className="sr-only" role="status">Loading content</span>
    </main>
  );
}
