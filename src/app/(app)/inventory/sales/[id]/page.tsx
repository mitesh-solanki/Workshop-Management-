import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function DirectSaleDetailRedirect(_props: Props) {
  redirect("/inventory/sales");
}
