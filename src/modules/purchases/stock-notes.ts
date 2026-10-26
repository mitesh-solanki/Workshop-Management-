import { createTranslator } from "next-intl";
import en from "../../../messages/en.json";

const t = createTranslator({
  locale: "en",
  messages: en,
  namespace: "purchases",
});

export function purchaseOrderReceiptStockNote(poNumber: string) {
  return t("stockNotes.poReceipt", { number: poNumber });
}

export function purchaseReturnStockNote() {
  return t("stockNotes.purchaseReturn");
}
