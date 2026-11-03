"use client";

import {
  confirmPaperCopyAction,
  replacePaperCopyAction,
  requestPaperCopyUploadUrlAction,
} from "@/app/actions/service-orders";
import { compressImageFile } from "@/lib/compress-image";
import { uploadBlobToStorageTarget } from "@/lib/client-storage-upload";

async function preparePaperFile(file: File) {
  let blob: Blob = file;
  let contentType = file.type || "application/octet-stream";
  let fileName = file.name;
  if (
    contentType === "application/octet-stream" &&
    fileName.toLowerCase().endsWith(".pdf")
  ) {
    contentType = "application/pdf";
  }

  if (contentType.startsWith("image/")) {
    const compressed = await compressImageFile(file);
    blob = compressed.blob;
    contentType = compressed.contentType;
    fileName = compressed.fileName || file.name;
  }

  return { blob, contentType, fileName };
}

export async function uploadPaperJobCardFile(input: {
  serviceOrderId: string;
  file: File;
  uploadFailedMessage: string;
  customerId?: string;
  vehicleId?: string;
  replacePaperCopyId?: string;
}) {
  const prepared = await preparePaperFile(input.file);

  const signed = await requestPaperCopyUploadUrlAction({
    serviceOrderId: input.serviceOrderId,
    contentType: prepared.contentType,
    byteSize: prepared.blob.size,
    fileName: prepared.fileName,
    replacePaperCopyId: input.replacePaperCopyId,
  });

  try {
    const uploaded = await uploadBlobToStorageTarget({
      target: signed,
      blob: prepared.blob,
      contentType: prepared.contentType,
      fileName: prepared.fileName,
    });

    if (input.replacePaperCopyId) {
      const result = await replacePaperCopyAction({
        serviceOrderId: input.serviceOrderId,
        paperCopyId: input.replacePaperCopyId,
        storageKey: uploaded.storageKey,
        contentType: prepared.contentType,
        byteSize: prepared.blob.size,
        fileName: prepared.fileName,
        customerId: input.customerId,
        vehicleId: input.vehicleId,
      });
      if (!result.ok) {
        throw new Error(result.message ?? input.uploadFailedMessage);
      }
      return result;
    }

    const result = await confirmPaperCopyAction({
      serviceOrderId: input.serviceOrderId,
      storageKey: uploaded.storageKey,
      contentType: prepared.contentType,
      byteSize: prepared.blob.size,
      fileName: prepared.fileName,
      customerId: input.customerId,
      vehicleId: input.vehicleId,
    });
    if (!result.ok) {
      throw new Error(result.message ?? input.uploadFailedMessage);
    }
    return result;
  } catch (error) {
    if (error instanceof Error && error.message !== input.uploadFailedMessage) {
      throw error;
    }
    throw new Error(input.uploadFailedMessage);
  }
}

export async function uploadPaperJobCardFiles(input: {
  serviceOrderId: string;
  files: File[];
  uploadFailedMessage: string;
  customerId?: string;
  vehicleId?: string;
  maxFiles?: number;
}) {
  const files = input.files.slice(0, input.maxFiles ?? input.files.length);
  let uploaded = 0;
  let lastMessage: string | undefined;
  for (const file of files) {
    const result = await uploadPaperJobCardFile({
      serviceOrderId: input.serviceOrderId,
      file,
      uploadFailedMessage: input.uploadFailedMessage,
      customerId: input.customerId,
      vehicleId: input.vehicleId,
    });
    uploaded += 1;
    lastMessage = result.message;
  }
  return { uploaded, message: lastMessage };
}
