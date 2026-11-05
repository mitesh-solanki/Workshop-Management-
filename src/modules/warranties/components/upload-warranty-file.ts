"use client";

import { requestWarrantyUploadUrlAction } from "@/app/actions/warranties";
import { compressImageFile } from "@/lib/compress-image";
import { uploadBlobToStorageTarget } from "@/lib/client-storage-upload";

export async function uploadWarrantyCardFile(input: {
  vehicleId: string;
  file: File;
  uploadFailedMessage: string;
}) {
  if (!input.vehicleId.trim()) {
    throw new Error(input.uploadFailedMessage);
  }

  let blob: Blob = input.file;
  let contentType = input.file.type || "application/octet-stream";
  let fileName = input.file.name;

  try {
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

    if (
      !signed ||
      typeof signed !== "object" ||
      !("uploadUrl" in signed) ||
      !("storageKey" in signed) ||
      typeof signed.uploadUrl !== "string" ||
      typeof signed.storageKey !== "string"
    ) {
      throw new Error(input.uploadFailedMessage);
    }

    const uploaded = await uploadBlobToStorageTarget({
      target: {
        uploadUrl: signed.uploadUrl,
        storageKey: signed.storageKey,
        method: signed.method,
        fields: signed.fields,
      },
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
  } catch (error) {
    if (
      error instanceof Error &&
      error.message &&
      error.message !== "Upload failed" &&
      error.message !== input.uploadFailedMessage
    ) {
      throw error;
    }
    throw new Error(input.uploadFailedMessage);
  }
}
