import { PageSpinner } from "@/components/shared/page-spinner";

export default function LiveLinkLoading() {
  return (
    <main className="flex min-h-svh w-full flex-col items-center justify-center overflow-hidden">
      <PageSpinner className="min-h-0 flex-none" />
    </main>
  );
}
