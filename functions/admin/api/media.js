import { requireAdmin } from "../../_lib/access.js";
import { HttpError, handleError, json } from "../../_lib/http.js";
import { publicMediaUrl } from "../../_lib/artworks.js";

const VARIANT_LIMITS = {
  display: 8_000_000,
  thumbnail: 1_000_000,
};

function requireBindings(env) {
  if (!env.DB || !env.ART_BUCKET) {
    throw new HttpError(503, "Gallery storage bindings are not configured.", "storage_not_configured");
  }
}

function storageLimit(env) {
  const configured = Number(env.MAX_STORAGE_BYTES);
  return Number.isFinite(configured) && configured >= 1_000_000
    ? Math.min(configured, 9_500_000_000)
    : 9_000_000_000;
}

function cleanArtworkId(value) {
  const id = String(value || "").trim();
  if (!/^[a-zA-Z0-9-]{3,80}$/.test(id)) {
    throw new HttpError(400, "The artwork identifier is invalid.", "invalid_artwork_id");
  }
  return id;
}

function cleanVariant(value) {
  const variant = String(value || "").trim();
  if (!(variant in VARIANT_LIMITS)) {
    throw new HttpError(400, "The image variant is invalid.", "invalid_variant");
  }
  return variant;
}

function cleanObjectKey(value) {
  const key = String(value || "").trim();
  if (!/^artworks\/[a-zA-Z0-9-]{3,80}\/[a-zA-Z0-9_.-]+$/.test(key)) {
    throw new HttpError(400, "The image reference is invalid.", "invalid_media_key");
  }
  return key;
}

async function currentStorage(env) {
  const row = await env.DB.prepare(
    "SELECT COALESCE(SUM(byte_size), 0) AS used_bytes FROM media_objects",
  ).first();
  return Number(row?.used_bytes || 0);
}

export async function onRequestGet(context) {
  try {
    await requireAdmin(context);
    requireBindings(context.env);

    return json(
      {
        usedBytes: await currentStorage(context.env),
        limitBytes: storageLimit(context.env),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleError(error, context.request, "get_storage_usage");
  }
}

export async function onRequestPost(context) {
  try {
    const administrator = await requireAdmin(context);
    requireBindings(context.env);

    const artworkId = cleanArtworkId(context.request.headers.get("X-Artwork-Id"));
    const variant = cleanVariant(context.request.headers.get("X-Image-Variant"));
    const declaredSize = Number(context.request.headers.get("X-Upload-Size"));
    const maximumSize = VARIANT_LIMITS[variant];
    if (!Number.isInteger(declaredSize) || declaredSize <= 0 || declaredSize > maximumSize) {
      throw new HttpError(
        413,
        `The ${variant} image must be smaller than ${Math.round(maximumSize / 1_000_000)} MB.`,
        "image_too_large",
      );
    }

    const contentLength = Number(context.request.headers.get("Content-Length") || 0);
    if (contentLength > maximumSize) {
      throw new HttpError(413, "The uploaded image is too large.", "image_too_large");
    }
    if (context.request.headers.get("Content-Type") !== "image/webp") {
      throw new HttpError(415, "Uploaded gallery images must be WebP files.", "unsupported_image_type");
    }
    if (!context.request.body) {
      throw new HttpError(400, "The uploaded image is empty.", "empty_upload");
    }

    const usedBytes = await currentStorage(context.env);
    const maximumStorage = storageLimit(context.env);
    if (usedBytes + declaredSize > maximumStorage) {
      throw new HttpError(
        507,
        "The gallery has reached its free storage safety limit.",
        "storage_limit_reached",
      );
    }

    const objectKey = `artworks/${artworkId}/${crypto.randomUUID()}-${variant}.webp`;
    const objectUrl = publicMediaUrl(context.env.PUBLIC_IMAGE_BASE_URL, objectKey);
    const storedObject = await context.env.ART_BUCKET.put(objectKey, context.request.body, {
      httpMetadata: {
        contentType: "image/webp",
        cacheControl: "public, max-age=31536000, immutable",
      },
      customMetadata: {
        artworkId,
        variant,
        uploadedBy: administrator.email,
      },
    });
    if (!storedObject) {
      throw new Error("R2 did not return the stored object.");
    }

    if (storedObject.size !== declaredSize || storedObject.size > maximumSize) {
      await context.env.ART_BUCKET.delete(objectKey);
      throw new HttpError(400, "The uploaded image size did not match the request.", "upload_size_mismatch");
    }

    try {
      await context.env.DB.prepare(
        `INSERT INTO media_objects (object_key, artwork_id, variant, byte_size)
         VALUES (?1, ?2, ?3, ?4)`,
      ).bind(objectKey, artworkId, variant, storedObject.size).run();
    } catch (error) {
      await context.env.ART_BUCKET.delete(objectKey);
      throw error;
    }

    return json(
      {
        key: objectKey,
        url: objectUrl,
        byteSize: storedObject.size,
        usedBytes: usedBytes + storedObject.size,
        limitBytes: maximumStorage,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleError(error, context.request, "upload_gallery_image");
  }
}

export async function onRequestDelete(context) {
  try {
    await requireAdmin(context);
    requireBindings(context.env);

    const objectKey = cleanObjectKey(new URL(context.request.url).searchParams.get("key"));
    const referenced = await context.env.DB.prepare(
      `SELECT id FROM artworks
       WHERE image_key = ?1 OR thumbnail_key = ?1
       LIMIT 1`,
    ).bind(objectKey).first();
    if (referenced) {
      throw new HttpError(409, "This image is currently used by an artwork.", "media_in_use");
    }

    await context.env.ART_BUCKET.delete(objectKey);
    await context.env.DB.prepare(
      "DELETE FROM media_objects WHERE object_key = ?1",
    ).bind(objectKey).run();

    return json(
      { deleted: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleError(error, context.request, "delete_gallery_image");
  }
}
