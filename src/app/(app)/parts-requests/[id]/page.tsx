import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function PartsRequestDetailRedirect({ params }: Props) {
  await params;
  redirect("/parts-requests");
}
