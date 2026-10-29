import "server-only";

import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "node:crypto";
import {
  cloudinaryDeliveryUrl,
  deleteDocument,
  getCloudinaryRootFolder,
  isCloudinaryConfigured,
  resourceTypeFromStorageKey,
  uploadWithPublicId,
} from "@/lib/cloudinary";
import { AppError } from "@/lib/errors";

let bucketReady: Promise<void> | null = null;

export type StorageUploadTarget = {
  uploadUrl: string;
  storageKey: string;
  /** Browser upload verb. Cloudinary uses POST multipart; S3 uses PUT. */
  method: "PUT" | "POST";
  /** Extra form fields for POST uploads (Cloudinary / app upload API). */
  fields?: Record<string, string>;
  bucket?: string;
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new AppError("STORAGE_NOT_CONFIGURED", 500);
  }
  return value;
}

function getBucket() {
  return requireEnv("S3_BUCKET");
}

function getClient() {
  const endpoint = requireEnv("S3_ENDPOINT");
  return new S3Client({
    region: process.env.S3_REGION?.trim() || "us-east-1",
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: requireEnv("S3_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY"),
    },
  });
}

/** Prefer Cloudinary when configured (temp production); otherwise S3/MinIO. */
export function getStorageDriver(): "cloudinary" | "s3" {
  const explicit = process.env.STORAGE_DRIVER?.trim().toLowerCase();
  if (explicit === "cloudinary" || explicit === "s3") {
    return explicit;
  }
  if (isCloudinaryConfigured()) {
    return "cloudinary";
  }
  return "s3";
}

/** Create the configured bucket once if it does not exist (local MinIO). */
async function ensureBucket() {
  if (!bucketReady) {
    bucketReady = (async () => {
      const client = getClient();
      const bucket = getBucket();
      try {
        await client.send(new HeadBucketCommand({ Bucket: bucket }));
      } catch {
        try {
          await client.send(new CreateBucketCommand({ Bucket: bucket }));
        } catch (error) {
          const name =
            error && typeof error === "object" && "name" in error
              ? String((error as { name: unknown }).name)
              : "";
          if (
            name !== "BucketAlreadyOwnedByYou" &&
            name !== "BucketAlreadyExists"
          ) {
            bucketReady = null;
            throw error;
          }
        }
      }
    })();
  }
  await bucketReady;
}

function extensionForContentType(contentType: string): string {
  const lower = contentType.toLowerCase();
  if (lower.includes("jpeg") || lower.includes("jpg")) {
    return "jpg";
  }
  if (lower.includes("png")) {
    return "png";
  }
  if (lower.includes("webp")) {
    return "webp";
  }
  if (lower.includes("pdf")) {
    return "pdf";
  }
  if (lower.includes("webm")) {
    return "webm";
  }
  if (lower.includes("quicktime")) {
    return "mov";
  }
  return "mp4";
}

/**
 * Cloudinary public_id under the workshop folder, without file extension.
 * Example: workshop/garages/{garageId}/inspections/.../abc
 */
export function toCloudinaryPublicId(storageKey: string): string {
  const withoutExt = storageKey.replace(/\.[^.]+$/, "");
  const folder = getCloudinaryRootFolder();
  if (withoutExt === folder || withoutExt.startsWith(`${folder}/`)) {
    return withoutExt;
  }
  return `${folder}/${withoutExt}`;
}

/** Build a garage-scoped object key for an inspection media upload. */
export function buildInspectionMediaKey(input: {
  garageId: string;
  inspectionId: string;
  itemId: string;
  contentType: string;
}) {
  const ext = extensionForContentType(input.contentType);
  const id = randomBytes(12).toString("hex");
  return `garages/${input.garageId}/inspections/${input.inspectionId}/items/${input.itemId}/${id}.${ext}`;
}

/** Build a garage-scoped object key for a vendor bill attachment. */
export function buildVendorBillAttachmentKey(input: {
  garageId: string;
  vendorBillId: string;
  contentType: string;
}) {
  const ext = extensionForContentType(input.contentType);
  const id = randomBytes(12).toString("hex");
  return `garages/${input.garageId}/vendor-bills/${input.vendorBillId}/${id}.${ext}`;
}

/** Build a garage-scoped object key for a vehicle warranty card photo. */
export function buildVehicleWarrantyKey(input: {
  garageId: string;
  vehicleId: string;
  contentType: string;
}) {
  const ext = extensionForContentType(input.contentType);
  const id = randomBytes(12).toString("hex");
  return `garages/${input.garageId}/vehicles/${input.vehicleId}/warranty/${id}.${ext}`;
}

/**
 * Presigned PUT (S3) or app POST target (Cloudinary) for browser upload.
 * Cloudinary path posts the file to `/api/storage/upload` (server uploads).
 */
export async function createPresignedUploadUrl(input: {
  storageKey: string;
  contentType: string;
  expiresInSeconds?: number;
}): Promise<StorageUploadTarget> {
  if (getStorageDriver() === "cloudinary") {
    if (!isCloudinaryConfigured()) {
      throw new AppError("STORAGE_NOT_CONFIGURED", 500);
    }
    return {
      uploadUrl: "/api/storage/upload",
      storageKey: input.storageKey,
      method: "POST",
      fields: {
        storageKey: input.storageKey,
        contentType: input.contentType,
      },
    };
  }

  await ensureBucket();
  const client = getClient();
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: input.storageKey,
    ContentType: input.contentType,
  });
  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: input.expiresInSeconds ?? 600,
  });
  return {
    uploadUrl,
    storageKey: input.storageKey,
    method: "PUT",
    bucket: getBucket(),
  };
}

/**
 * Browser-readable URL for a stored object.
 * Cloudinary: CDN delivery URL. S3: short-lived signed GET.
 */
export async function createPresignedDownloadUrl(
  storageKey: string,
  expiresInSeconds = 3600,
): Promise<string> {
  if (getStorageDriver() === "cloudinary") {
    const publicId = toCloudinaryPublicId(storageKey);
    return cloudinaryDeliveryUrl(
      publicId,
      resourceTypeFromStorageKey(storageKey),
    );
  }

  const client = getClient();
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: storageKey,
  });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

export async function deleteStoredObject(storageKey: string) {
  if (getStorageDriver() === "cloudinary") {
    const publicId = toCloudinaryPublicId(storageKey);
    const resourceType = resourceTypeFromStorageKey(storageKey);
    try {
      await deleteDocument(publicId, resourceType);
    } catch {
      // Retry as image/video/raw if type guess was wrong.
      if (resourceType !== "image") {
        try {
          await deleteDocument(publicId, "image");
          return;
        } catch {
          /* continue */
        }
      }
      if (resourceType !== "video") {
        try {
          await deleteDocument(publicId, "video");
          return;
        } catch {
          /* continue */
        }
      }
      await deleteDocument(publicId, "raw");
    }
    return;
  }

  const client = getClient();
  await client.send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: storageKey,
    }),
  );
}

/** Server-side Cloudinary upload used by `/api/storage/upload`. */
export async function uploadBufferToStorage(input: {
  storageKey: string;
  contentType: string;
  fileBuffer: Buffer;
}): Promise<{ storageKey: string; url: string }> {
  if (getStorageDriver() !== "cloudinary") {
    throw new AppError("STORAGE_NOT_CONFIGURED", 500);
  }
  const publicId = toCloudinaryPublicId(input.storageKey);
  const uploaded = await uploadWithPublicId({
    fileBuffer: input.fileBuffer,
    publicId,
    contentType: input.contentType,
  });
  return { storageKey: input.storageKey, url: uploaded.url };
}

/** True when the key belongs to this garage (prevents confirm of foreign keys). */
export function storageKeyBelongsToGarage(
  storageKey: string,
  garageId: string,
): boolean {
  return storageKey.startsWith(`garages/${garageId}/`);
}
