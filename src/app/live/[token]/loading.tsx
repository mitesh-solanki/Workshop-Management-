import { Skeleton } from "@/components/ui/skeleton";

export default function LiveLinkLoading() {
  return (
    <main
      className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8 sm:px-6"
      aria-busy="true"
    >
      <div className="space-y-2 border-b border-border pb-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-56" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="aspect-square w-full rounded-lg" />
          <Skeleton className="aspect-square w-full rounded-lg" />
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    </main>
  );
}
