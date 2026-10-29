import { NextResponse } from "next/server";
import {
  storageKeyBelongsToGarage,
  uploadBufferToStorage,
} from "@/lib/storage";
import { getOptionalSession } from "@/lib/session";

const MAX_BYTES = 50 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const storageKeyValue = formData.get("storageKey");
    const contentTypeValue = formData.get("contentType");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 },
      );
    }

    if (typeof storageKeyValue !== "string" || !storageKeyValue.trim()) {
      return NextResponse.json(
        { success: false, error: "storageKey is required" },
        { status: 400 },
      );
    }

    const storageKey = storageKeyValue.trim();
    if (!storageKeyBelongsToGarage(storageKey, session.garageId)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: "File too large" },
        { status: 413 },
      );
    }

    const contentType =
      (typeof contentTypeValue === "string" && contentTypeValue.trim()) ||
      file.type ||
      "application/octet-stream";

    const bytes = await file.arrayBuffer();
    const uploaded = await uploadBufferToStorage({
      storageKey,
      contentType,
      fileBuffer: Buffer.from(bytes),
    });

    return NextResponse.json({
      success: true,
      data: {
        storageKey: uploaded.storageKey,
        url: uploaded.url,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    const status = message === "STORAGE_NOT_CONFIGURED" ? 500 : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status },
    );
  }
}

/** Optional client-triggered delete (Cruise-style); services also delete on remove. */
export async function DELETE(request: Request) {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as {
      storageKey?: string;
      publicId?: string;
    };
    const storageKey =
      (typeof body.storageKey === "string" && body.storageKey.trim()) ||
      (typeof body.publicId === "string" && body.publicId.trim()) ||
      "";

    if (!storageKey) {
      return NextResponse.json(
        { success: false, error: "storageKey is required" },
        { status: 400 },
      );
    }

    if (!storageKeyBelongsToGarage(storageKey, session.garageId)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const { deleteStoredObject } = await import("@/lib/storage");
    await deleteStoredObject(storageKey);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Delete failed",
      },
      { status: 500 },
    );
  }
}
