import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{
    partId?: string;
    q?: string;
    status?: string;
  }>;
};

export default async function PartsRequestsRedirectPage({
  searchParams,
}: Props) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.partId?.trim()) {
    query.set("partId", params.partId.trim());
  }
  const suffix = query.toString();
  redirect(
    suffix ? `/purchase-orders/new?${suffix}` : "/purchase-orders",
  );
}
