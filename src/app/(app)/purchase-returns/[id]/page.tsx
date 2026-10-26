import { notFound, redirect } from "next/navigation";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import {
  assertCanAccessVendorMoney,
  getPurchaseReturn,
} from "@/modules/purchases/service";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function PurchaseReturnDetailRedirect({ params }: Props) {
  const session = await requireSession();
  const { id } = await params;

  try {
    assertCanAccessVendorMoney(session);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      redirect("/purchase-returns");
    }
    throw error;
  }

  let vendorId: string;
  try {
    const row = await getPurchaseReturn(session, id);
    vendorId = row.vendor.id;
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  redirect(`/vendors/${vendorId}?section=returns`);
}
