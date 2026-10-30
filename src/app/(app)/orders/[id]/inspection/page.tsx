import { redirect } from "next/navigation";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { homePathForRole } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { getInspectionForOrder } from "@/modules/inspections/service";

type Props = {
  params: Promise<{ id: string }>;
};

export const instant = false;

export default async function OrderInspectionRedirectPage({ params }: Props) {
  const session = await requireSession();
  if (session.role === "TECHNICIAN") {
    redirect(homePathForRole(session.role));
  }
  const { id } = await params;

  try {
    const inspection = await getInspectionForOrder(session, id);
    if (inspection) {
      redirect(`/inspections/${inspection.id}`);
    }
  } catch (error) {
    if (!(error instanceof NotFoundError || error instanceof ForbiddenError)) {
      throw error;
    }
  }

  redirect(`/orders/${id}`);
}
