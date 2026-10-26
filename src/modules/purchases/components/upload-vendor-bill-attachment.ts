"use client";

import {
  confirmVendorBillAttachmentAction,
  requestVendorBillAttachmentUploadUrlAction,
} from "@/app/actions/purchases";
import { compressImageFile } from "@/lib/compress-image";

export async function uploadVendorBillAttachmentFile(input: {
  vendorBillId: string;
  file: File;
  uploadFailedMessage: string;
}) {
  let blob: Blob = input.file;
  let contentType = input.file.type || "application/octet-stream";
  let fileName = input.file.name;

  if (contentType.startsWith("image/")) {
    const compressed = await compressImageFile(input.file);
    blob = compressed.blob;
    contentType = compressed.contentType;
    fileName = compressed.fileName || input.file.name;
  }

  const signed = await requestVendorBillAttachmentUploadUrlAction({
    vendorBillId: input.vendorBillId,
    contentType,
    byteSize: blob.size,
    fileName,
  });

  const put = await fetch(signed.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!put.ok) {
    throw new Error(input.uploadFailedMessage);
  }

  const result = await confirmVendorBillAttachmentAction({
    vendorBillId: input.vendorBillId,
    storageKey: signed.storageKey,
    contentType,
    byteSize: blob.size,
    fileName,
  });
  if (!result.ok) {
    throw new Error(result.message ?? input.uploadFailedMessage);
  }
  return result;
}
