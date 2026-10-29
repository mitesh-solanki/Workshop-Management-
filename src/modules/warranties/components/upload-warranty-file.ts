"use client";

import { requestWarrantyUploadUrlAction } from "@/app/actions/warranties";
import { compressImageFile } from "@/lib/compress-image";
import { uploadBlobToStorageTarget } from "@/lib/client-storage-upload";

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

  try {
    const uploaded = await uploadBlobToStorageTarget({
      target: signed,
      blob,
      contentType,
      fileName,
    });

    return {
      storageKey: uploaded.storageKey,
      contentType,
      byteSize: blob.size,
      fileName,
    };
  } catch {
    throw new Error(input.uploadFailedMessage);
  }
}
