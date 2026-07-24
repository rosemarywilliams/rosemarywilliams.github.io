import { HttpError, handleError } from "../../_lib/http.js";

function artworkObjectKey(value) {
  const segments = Array.isArray(value) ? value : [value];
  const key = segments.map((segment) => String(segment || "")).join("/");
  if (!/^artworks\/[a-zA-Z0-9-]{3,80}\/[a-zA-Z0-9_.-]+-(display|thumbnail)\.webp$/.test(key)) {
    throw new HttpError(404, "That gallery image could not be found.", "image_not_found");
  }
  return key;
}

function requireBucket(env) {
  if (!env.ART_BUCKET) {
    throw new HttpError(503, "Gallery image storage is not configured.", "storage_not_configured");
  }
}

function objectHeaders(object) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", object.httpMetadata?.cacheControl || "public, max-age=31536000, immutable");
  headers.set("ETag", object.httpEtag);
  headers.set("X-Content-Type-Options", "nosniff");
  return headers;
}

export async function onRequestGet(context) {
  try {
    requireBucket(context.env);
    const key = artworkObjectKey(context.params.path);
    const object = await context.env.ART_BUCKET.get(key);
    if (!object) {
      throw new HttpError(404, "That gallery image could not be found.", "image_not_found");
    }

    return new Response(object.body, {
      headers: objectHeaders(object),
    });
  } catch (error) {
    return handleError(error, context.request, "get_public_gallery_image");
  }
}

export async function onRequestHead(context) {
  try {
    requireBucket(context.env);
    const key = artworkObjectKey(context.params.path);
    const object = await context.env.ART_BUCKET.head(key);
    if (!object) {
      throw new HttpError(404, "That gallery image could not be found.", "image_not_found");
    }

    return new Response(null, {
      headers: objectHeaders(object),
    });
  } catch (error) {
    return handleError(error, context.request, "head_public_gallery_image");
  }
}
