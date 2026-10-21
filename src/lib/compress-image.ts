/**
 * Compress an image in the browser before upload.
 * Uses canvas + JPEG to keep workshop phone photos small for MinIO/S3.
 */
export async function compressImageFile(
  file: File,
  options: { maxWidth?: number; maxHeight?: number; quality?: number } = {},
): Promise<{ blob: Blob; contentType: string; fileName: string }> {
  const maxWidth = options.maxWidth ?? 1600;
  const maxHeight = options.maxHeight ?? 1600;
  const quality = options.quality ?? 0.72;

  if (!file.type.startsWith("image/")) {
    throw new Error("Not an image file");
  }

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(
      1,
      maxWidth / bitmap.width,
      maxHeight / bitmap.height,
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not draw image");
    }
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (!result) {
            reject(new Error("Image compression failed"));
            return;
          }
          resolve(result);
        },
        "image/jpeg",
        quality,
      );
    });

    const base =
      file.name.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "_") || "photo";
    return {
      blob,
      contentType: "image/jpeg",
      fileName: `${base}.jpg`,
    };
  } finally {
    bitmap.close();
  }
}
