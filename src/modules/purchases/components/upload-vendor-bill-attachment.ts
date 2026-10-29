"use client";

import {
  confirmVendorBillAttachmentAction,
  requestVendorBillAttachmentUploadUrlAction,
} from "@/app/actions/purchases";
import { compressImageFile } from "@/lib/compress-image";
import { uploadBlobToStorageTarget } from "@/lib/client-storage-upload";

export async function uploadVendorBillAttachmentFile(input: {
  vendorBillId: string;
  file: File;
  uploadFailedMessage: string;
}) {
  let blob: Blob = input.file;
  let contentType = input.file.type || "application/octet-stream";
  let fileName = input.file.name;
  if (
    contentType === "application/octet-stream" &&
    fileName.toLowerCase().endsWith(".pdf")
  ) {
    contentType = "application/pdf";
  }

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

  try {
    const uploaded = await uploadBlobToStorageTarget({
      target: signed,
      blob,
      contentType,
      fileName,
    });

    const result = await confirmVendorBillAttachmentAction({
      vendorBillId: input.vendorBillId,
      storageKey: uploaded.storageKey,
      contentType,
      byteSize: blob.size,
      fileName,
    });
    if (!result.ok) {
      throw new Error(result.message ?? input.uploadFailedMessage);
    }
    return result;
  } catch {
    throw new Error(input.uploadFailedMessage);
  }
}
