import { HttpError } from "./http.js";

const FRAMES = new Set(["frame-1", "frame-2", "frame-3", "frame-4"]);
const OFFSETS = new Set([
  "-translate-y-32",
  "-translate-y-28",
  "-translate-y-24",
  "-translate-y-20",
  "-translate-y-12",
  "-translate-y-8",
  "translate-y-0",
  "translate-y-8",
  "translate-y-12",
  "translate-y-14",
  "translate-y-16",
  "translate-y-20",
  "translate-y-24",
  "translate-y-32",
  "translate-y-36",
  "translate-y-40",
]);

function cleanText(value, name, maximumLength, required = false) {
  const text = String(value ?? "").trim();
  if (required && !text) {
    throw new HttpError(400, `${name} is required.`, "invalid_artwork");
  }
  if (text.length > maximumLength) {
    throw new HttpError(400, `${name} is too long.`, "invalid_artwork");
  }
  return text;
}

function cleanBoolean(value) {
  return value === true || value === 1 || value === "1";
}

function cleanOrder(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 1_000_000) {
    throw new HttpError(400, "Display order must be a positive whole number.", "invalid_artwork");
  }
  return number;
}

function cleanId(value) {
  const id = String(value || "").trim();
  if (!/^[a-zA-Z0-9-]{3,80}$/.test(id)) {
    throw new HttpError(400, "The artwork identifier is invalid.", "invalid_artwork");
  }
  return id;
}

function cleanObjectKey(value, artworkId) {
  const key = String(value || "").trim();
  if (!key) return "";
  if (!key.startsWith(`artworks/${artworkId}/`) || !/^[a-zA-Z0-9/_\-.]+$/.test(key)) {
    throw new HttpError(400, "The uploaded image reference is invalid.", "invalid_media_key");
  }
  return key;
}

function cleanLegacyUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^images\/art\/[a-zA-Z0-9_.-]+$/.test(url) || /^https:\/\/[^\s]+$/.test(url)) {
    return url;
  }
  throw new HttpError(400, "The legacy image URL is invalid.", "invalid_image_url");
}

export function validateArtwork(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "Artwork data is required.", "invalid_artwork");
  }

  const id = cleanId(value.id);
  const frame = FRAMES.has(value.frame) ? value.frame : "frame-1";
  const yOffset = OFFSETS.has(value.yOffset) ? value.yOffset : "translate-y-0";
  const imageKey = cleanObjectKey(value.imageKey, id);
  const thumbnailKey = cleanObjectKey(value.thumbnailKey, id);
  const legacyImageUrl = cleanLegacyUrl(value.legacyImageUrl);

  if (!imageKey && !legacyImageUrl) {
    throw new HttpError(400, "Please choose an image for this artwork.", "image_required");
  }

  return {
    id,
    title: cleanText(value.title, "Title", 160, true),
    altText: cleanText(value.altText, "Image description", 320, true),
    medium: cleanText(value.medium, "Medium", 100),
    year: cleanText(value.year, "Year", 30),
    dimensions: cleanText(value.dimensions, "Dimensions", 100),
    frame,
    yOffset,
    imageKey: imageKey || null,
    thumbnailKey: thumbnailKey || null,
    legacyImageUrl,
    hidden: cleanBoolean(value.hidden),
    featured: cleanBoolean(value.featured),
    sortOrder: cleanOrder(value.sortOrder),
  };
}

export function publicMediaUrl(baseUrl, objectKey) {
  if (!objectKey) return "";
  const root = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (!/^https:\/\/[^\s]+$/.test(root)) {
    throw new HttpError(503, "The public image domain has not been configured.", "media_not_configured");
  }
  return `${root}/${objectKey.split("/").map(encodeURIComponent).join("/")}`;
}

function legacyUrl(value, requestUrl) {
  if (!value) return "";
  if (/^https:\/\//.test(value)) return value;
  return new URL(`/${value.replace(/^\/+/, "")}`, requestUrl).href;
}

export function serializeArtwork(row, env, requestUrl) {
  const imageUrl = row.image_key
    ? publicMediaUrl(env.PUBLIC_IMAGE_BASE_URL, row.image_key)
    : legacyUrl(row.legacy_image_url, requestUrl);
  const thumbnailUrl = row.thumbnail_key
    ? publicMediaUrl(env.PUBLIC_IMAGE_BASE_URL, row.thumbnail_key)
    : imageUrl;

  return {
    id: row.id,
    title: row.title,
    altText: row.alt_text,
    medium: row.medium,
    year: row.year,
    dimensions: row.dimensions,
    frame: row.frame,
    yOffset: row.y_offset,
    imageKey: row.image_key || "",
    thumbnailKey: row.thumbnail_key || "",
    legacyImageUrl: row.legacy_image_url || "",
    imageUrl,
    thumbnailUrl,
    hidden: row.is_hidden === 1,
    featured: row.is_featured === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findArtwork(env, id) {
  return env.DB.prepare("SELECT * FROM artworks WHERE id = ?1").bind(id).first();
}

export async function assertMediaBelongsToArtwork(env, artwork) {
  const expectedMedia = [
    artwork.imageKey ? { key: artwork.imageKey, variant: "display" } : null,
    artwork.thumbnailKey ? { key: artwork.thumbnailKey, variant: "thumbnail" } : null,
  ].filter(Boolean);
  if (expectedMedia.length === 0) return;

  const placeholders = expectedMedia.map((_, index) => `?${index + 2}`).join(", ");
  const result = await env.DB.prepare(
    `SELECT object_key, variant FROM media_objects
     WHERE artwork_id = ?1 AND object_key IN (${placeholders})`,
  ).bind(artwork.id, ...expectedMedia.map((media) => media.key)).all();

  const variantsByKey = new Map(
    result.results.map((media) => [media.object_key, media.variant]),
  );
  const allMediaMatches = expectedMedia.every(
    (media) => variantsByKey.get(media.key) === media.variant,
  );
  if (!allMediaMatches) {
    throw new HttpError(400, "One or more uploaded images could not be found.", "missing_media");
  }
}

export async function removeMediaObjects(env, keys) {
  const uniqueKeys = [...new Set(keys.filter(Boolean))];
  if (uniqueKeys.length === 0) return;

  await env.ART_BUCKET.delete(uniqueKeys);
  const placeholders = uniqueKeys.map((_, index) => `?${index + 1}`).join(", ");
  await env.DB.prepare(
    `DELETE FROM media_objects WHERE object_key IN (${placeholders})`,
  ).bind(...uniqueKeys).run();
}
