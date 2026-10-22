import { PageSpinner } from "@/components/shared/page-spinner";

export default function AppLoading() {
  return (
    <div className="w-full max-w-[1600px] flex-1 px-[34px] py-6">
      <PageSpinner />
    </div>
  );
}
