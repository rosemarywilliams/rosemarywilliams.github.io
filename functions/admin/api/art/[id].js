import { requireAdmin } from "../../../_lib/access.js";
import { HttpError, handleError, json, readJson } from "../../../_lib/http.js";
import {
  assertMediaBelongsToArtwork,
  findArtwork,
  removeMediaObjects,
  serializeArtwork,
  validateArtwork,
} from "../../../_lib/artworks.js";

function routeId(context) {
  const value = Array.isArray(context.params.id) ? context.params.id[0] : context.params.id;
  const id = String(value || "").trim();
  if (!/^[a-zA-Z0-9-]{3,80}$/.test(id)) {
    throw new HttpError(400, "The artwork identifier is invalid.", "invalid_artwork_id");
  }
  return id;
}

function requireBindings(env) {
  if (!env.DB || !env.ART_BUCKET) {
    throw new HttpError(503, "Gallery storage bindings are not configured.", "storage_not_configured");
  }
}

export async function onRequestPut(context) {
  try {
    await requireAdmin(context);
    requireBindings(context.env);

    const id = routeId(context);
    const existing = await findArtwork(context.env, id);
    if (!existing) {
      throw new HttpError(404, "That artwork could not be found.", "artwork_not_found");
    }

    const artwork = validateArtwork(await readJson(context.request));
    if (artwork.id !== id) {
      throw new HttpError(400, "The artwork identifier cannot be changed.", "id_mismatch");
    }
    await assertMediaBelongsToArtwork(context.env, artwork);

    await context.env.DB.prepare(
      `UPDATE artworks SET
        title = ?1,
        alt_text = ?2,
        medium = ?3,
        year = ?4,
        dimensions = ?5,
        frame = ?6,
        y_offset = ?7,
        image_key = ?8,
        thumbnail_key = ?9,
        legacy_image_url = ?10,
        is_hidden = ?11,
        is_featured = ?12,
        sort_order = ?13,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?14`,
    ).bind(
      artwork.title,
      artwork.altText,
      artwork.medium,
      artwork.year,
      artwork.dimensions,
      artwork.frame,
      artwork.yOffset,
      artwork.imageKey,
      artwork.thumbnailKey,
      artwork.legacyImageUrl,
      artwork.hidden ? 1 : 0,
      artwork.featured ? 1 : 0,
      artwork.sortOrder,
      id,
    ).run();

    const staleKeys = [existing.image_key, existing.thumbnail_key]
      .filter((key) => key && key !== artwork.imageKey && key !== artwork.thumbnailKey);
    if (staleKeys.length > 0) {
      context.waitUntil(
        removeMediaObjects(context.env, staleKeys).catch((error) => {
          console.error(JSON.stringify({
            message: "Could not remove superseded artwork media",
            artworkId: id,
            error: error instanceof Error ? error.message : String(error),
          }));
        }),
      );
    }

    const updated = await findArtwork(context.env, id);
    return json(
      serializeArtwork(updated, context.env, context.request.url),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleError(error, context.request, "update_artwork");
  }
}

export async function onRequestDelete(context) {
  try {
    await requireAdmin(context);
    requireBindings(context.env);

    const id = routeId(context);
    const existing = await findArtwork(context.env, id);
    if (!existing) {
      throw new HttpError(404, "That artwork could not be found.", "artwork_not_found");
    }

    await context.env.DB.prepare("DELETE FROM artworks WHERE id = ?1").bind(id).run();
    context.waitUntil(
      removeMediaObjects(context.env, [existing.image_key, existing.thumbnail_key]).catch((error) => {
        console.error(JSON.stringify({
          message: "Could not remove deleted artwork media",
          artworkId: id,
          error: error instanceof Error ? error.message : String(error),
        }));
      }),
    );

    return json(
      { deleted: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleError(error, context.request, "delete_artwork");
  }
}
