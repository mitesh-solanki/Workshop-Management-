import { Skeleton } from "@/components/ui/skeleton";

export default function OrdersLoading() {
  return (
    <main className="space-y-6 sm:space-y-8" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="hidden h-5 w-80 sm:block" />
      </div>
      <Skeleton className="h-11 w-full max-w-md" />
      <Skeleton className="h-72 w-full rounded-xl" />
    </main>
  );
}
