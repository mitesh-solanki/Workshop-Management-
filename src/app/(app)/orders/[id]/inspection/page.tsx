import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

/** Inspection lives in the job-card hub side nav. */
export default async function OrderInspectionPage({ params }: Props) {
  const { id } = await params;
  redirect(`/orders/${id}?section=inspection`);
}
