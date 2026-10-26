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
import { AppError } from "@/lib/errors";

let bucketReady: Promise<void> | null = null;

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
          // Another request may have created it first.
          const name =
            error && typeof error === "object" && "name" in error
              ? String((error as { name: unknown }).name)
              : "";
          if (name !== "BucketAlreadyOwnedByYou" && name !== "BucketAlreadyExists") {
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

/** Presigned PUT URL for browser upload to S3-compatible storage. */
export async function createPresignedUploadUrl(input: {
  storageKey: string;
  contentType: string;
  expiresInSeconds?: number;
}) {
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
  return { uploadUrl, storageKey: input.storageKey, bucket: getBucket() };
}

/**
 * Presigned GET URL so the browser can view private bucket objects
 * (local MinIO defaults to PRIVATE; production buckets should stay private too).
 */
export async function createPresignedDownloadUrl(
  storageKey: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const client = getClient();
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: storageKey,
  });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

export async function deleteStoredObject(storageKey: string) {
  const client = getClient();
  await client.send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: storageKey,
    }),
  );
}

/** True when the key belongs to this garage (prevents confirm of foreign keys). */
export function storageKeyBelongsToGarage(
  storageKey: string,
  garageId: string,
): boolean {
  return storageKey.startsWith(`garages/${garageId}/`);
}
