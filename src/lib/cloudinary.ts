import "server-only";

import { v2 as cloudinary } from "cloudinary";
import { AppError } from "@/lib/errors";

function requireCloudinaryEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new AppError("STORAGE_NOT_CONFIGURED", 500);
  }
  return value;
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
      process.env.CLOUDINARY_API_KEY?.trim() &&
      process.env.CLOUDINARY_API_SECRET?.trim(),
  );
}

/** Root Media Library folder for this app (default: workshop). */
export function getCloudinaryRootFolder(): string {
  const raw = process.env.CLOUDINARY_FOLDER?.trim();
  if (!raw) return "workshop";
  return raw.replace(/^\/+|\/+$/g, "");
}

function ensureConfigured() {
  cloudinary.config({
    cloud_name: requireCloudinaryEnv("CLOUDINARY_CLOUD_NAME"),
    api_key: requireCloudinaryEnv("CLOUDINARY_API_KEY"),
    api_secret: requireCloudinaryEnv("CLOUDINARY_API_SECRET"),
    secure: true,
  });
}

export type CloudinaryResourceType = "image" | "video" | "raw" | "auto";

export function resourceTypeFromContentType(
  contentType: string,
): Exclude<CloudinaryResourceType, "auto"> {
  const lower = contentType.toLowerCase();
  if (lower.startsWith("image/")) return "image";
  if (lower.startsWith("video/")) return "video";
  return "raw";
}

export function resourceTypeFromStorageKey(
  storageKey: string,
): Exclude<CloudinaryResourceType, "auto"> {
  const lower = storageKey.toLowerCase();
  if (/\.(jpe?g|png|webp|gif)$/.test(lower)) return "image";
  if (/\.(mp4|webm|mov)$/.test(lower)) return "video";
  return "raw";
}

export async function uploadImage(
  fileBuffer: Buffer,
  folder: string,
  resourceType: "image" | "video" = "image",
): Promise<{ url: string; publicId: string }> {
  ensureConfigured();
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        if (!result?.secure_url || !result?.public_id) {
          return reject(new Error("Upload did not return url or public_id"));
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    uploadStream.end(fileBuffer);
  });
}

export async function uploadDocument(
  fileBuffer: Buffer,
  folder: string,
  _filename?: string,
): Promise<{ url: string; publicId: string; resourceType: string }> {
  void _filename;
  ensureConfigured();
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "auto",
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        if (!result?.secure_url || !result?.public_id) {
          return reject(new Error("Upload did not return url or public_id"));
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          resourceType: result.resource_type ?? "raw",
        });
      },
    );
    uploadStream.end(fileBuffer);
  });
}

/**
 * Upload under the workshop root folder.
 * `publicId` is the path inside that folder (e.g. garages/.../id).
 */
export async function uploadWithPublicId(input: {
  fileBuffer: Buffer;
  publicId: string;
  contentType: string;
}): Promise<{ url: string; publicId: string; resourceType: string }> {
  ensureConfigured();
  const resourceType = resourceTypeFromContentType(input.contentType);
  const folder = getCloudinaryRootFolder();
  const relativeId = input.publicId.startsWith(`${folder}/`)
    ? input.publicId.slice(folder.length + 1)
    : input.publicId;
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: relativeId,
        resource_type: resourceType === "raw" ? "auto" : resourceType,
        overwrite: true,
        invalidate: true,
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        if (!result?.secure_url || !result?.public_id) {
          return reject(new Error("Upload did not return url or public_id"));
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          resourceType: result.resource_type ?? resourceType,
        });
      },
    );
    uploadStream.end(input.fileBuffer);
  });
}

export async function deleteImage(
  publicId: string,
  resourceType: "image" | "video" = "image",
): Promise<void> {
  ensureConfigured();
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

export async function deleteDocument(
  publicId: string,
  resourceType: CloudinaryResourceType = "raw",
): Promise<void> {
  ensureConfigured();
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

export function cloudinaryDeliveryUrl(
  publicId: string,
  resourceType: Exclude<CloudinaryResourceType, "auto"> = "image",
): string {
  ensureConfigured();
  return cloudinary.url(publicId, {
    secure: true,
    resource_type: resourceType,
  });
}

export { cloudinary };
