"use client";

import { requestWarrantyUploadUrlAction } from "@/app/actions/warranties";
import { compressImageFile } from "@/lib/compress-image";

export async function uploadWarrantyCardFile(input: {
  vehicleId: string;
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

  const signed = await requestWarrantyUploadUrlAction({
    vehicleId: input.vehicleId,
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

  return {
    storageKey: signed.storageKey,
    contentType,
    byteSize: blob.size,
    fileName,
  };
}
