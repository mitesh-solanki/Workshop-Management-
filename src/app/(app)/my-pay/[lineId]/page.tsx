import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ lineId: string }>;
};

/** Detail view removed — My Salary is list-only with Salary / Advance tabs. */
export default async function MyPayDetailPage({ params }: Props) {
  await params;
  redirect("/my-pay");
}
