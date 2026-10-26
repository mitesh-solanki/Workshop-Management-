import { redirect } from "next/navigation";

/** New sale is a modal on /inventory/sales — keep this route as a redirect. */
export default function NewDirectSalePage() {
  redirect("/inventory/sales");
}
