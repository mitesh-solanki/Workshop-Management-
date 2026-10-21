import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireRole, requireSession } from "@/lib/session";
import { CustomerForm } from "@/modules/customers/components/customer-form";
import { DeleteCustomerButton } from "@/modules/customers/components/delete-customer-button";
import { getCustomer } from "@/modules/customers/service";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditCustomerPage({ params }: Props) {
  const session = await requireSession();
  const { id } = await params;
  const t = await getTranslations("customers");

  try {
    requireRole(session, ["OWNER", "MANAGER", "TECHNICIAN"]);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return (
        <main className="space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("editTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("forbidden")}</p>
          <Link href={`/customers/${id}`} className="text-sm underline">
            {t("back")}
          </Link>
        </main>
      );
    }
    throw error;
  }

  let customer: Awaited<ReturnType<typeof getCustomer>>;
  try {
    customer = await getCustomer(session, id);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  return (
    <main className="space-y-6">
      <div className="space-y-2">
        <Link
          href={`/customers/${customer.id}`}
          className="text-sm text-muted-foreground underline"
        >
          {t("back")}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{t("editTitle")}</h1>
      </div>
      <CustomerForm
        mode="edit"
        customerId={customer.id}
        customer={{
          name: customer.name,
          phone: customer.phone,
          address: customer.address,
          notes: customer.notes,
        }}
      />
      <DeleteCustomerButton customerId={customer.id} />
    </main>
  );
}
