/**
 * Browser upload helper — S3 presigned PUT or Cloudinary via `/api/storage/upload`.
 */

export type ClientUploadTarget = {
  uploadUrl: string;
  storageKey: string;
  method?: "PUT" | "POST";
  fields?: Record<string, string>;
};

export async function uploadBlobToStorageTarget(input: {
  target: ClientUploadTarget;
  blob: Blob;
  contentType: string;
  fileName?: string;
}): Promise<{ storageKey: string }> {
  const method = input.target.method ?? "PUT";

  if (method === "POST") {
    const form = new FormData();
    for (const [key, value] of Object.entries(input.target.fields ?? {})) {
      form.append(key, value);
    }
    if (!form.has("storageKey")) {
      form.append("storageKey", input.target.storageKey);
    }
    if (!form.has("contentType")) {
      form.append("contentType", input.contentType);
    }
    form.append(
      "file",
      input.blob,
      input.fileName?.trim() || "upload",
    );

    const response = await fetch(input.target.uploadUrl, {
      method: "POST",
      body: form,
    });
    const json = (await response.json().catch(() => null)) as {
      success?: boolean;
      error?: string;
      data?: { storageKey?: string };
    } | null;

    if (!response.ok || !json?.success) {
      throw new Error(json?.error?.trim() || "Upload failed");
    }

    return {
      storageKey: json.data?.storageKey ?? input.target.storageKey,
    };
  }

  const put = await fetch(input.target.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": input.contentType },
    body: input.blob,
  });
  if (!put.ok) {
    throw new Error("Upload failed");
  }
  return { storageKey: input.target.storageKey };
}
