import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

/** Billing lives in the job-card hub side nav. */
export default async function OrderBillingPage({ params }: Props) {
  const { id } = await params;
  redirect(`/orders/${id}?section=billing`);
}
