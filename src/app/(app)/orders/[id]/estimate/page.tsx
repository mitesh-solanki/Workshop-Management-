import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

/** Estimate lives in the job-card hub side nav. */
export default async function OrderEstimatePage({ params }: Props) {
  const { id } = await params;
  redirect(`/orders/${id}?section=estimate`);
}
