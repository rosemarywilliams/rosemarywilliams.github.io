import { requireAdmin } from "../../../_lib/access.js";
import { HttpError, handleError, json, readJson } from "../../../_lib/http.js";
import {
  assertMediaBelongsToArtwork,
  findArtwork,
  serializeArtwork,
  validateArtwork,
} from "../../../_lib/artworks.js";

function requireDatabase(env) {
  if (!env.DB) {
    throw new HttpError(503, "The gallery database is not configured.", "database_not_configured");
  }
}

export async function onRequestGet(context) {
  try {
    await requireAdmin(context);
    requireDatabase(context.env);

    const result = await context.env.DB.prepare(
      `SELECT *
       FROM artworks
       ORDER BY sort_order ASC, created_at ASC
       LIMIT 2000`,
    ).all();

    return json(
      result.results.map((row) => serializeArtwork(row, context.env, context.request.url)),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleError(error, context.request, "list_admin_artworks");
  }
}

export async function onRequestPost(context) {
  try {
    await requireAdmin(context);
    requireDatabase(context.env);

    const artwork = validateArtwork(await readJson(context.request));
    if (await findArtwork(context.env, artwork.id)) {
      throw new HttpError(409, "An artwork with this identifier already exists.", "artwork_exists");
    }
    await assertMediaBelongsToArtwork(context.env, artwork);

    await context.env.DB.prepare(
      `INSERT INTO artworks (
        id, title, alt_text, medium, year, dimensions, frame, y_offset,
        image_key, thumbnail_key, legacy_image_url, is_hidden, is_featured, sort_order
      ) VALUES (
        ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8,
        ?9, ?10, ?11, ?12, ?13, ?14
      )`,
    ).bind(
      artwork.id,
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
    ).run();

    const created = await findArtwork(context.env, artwork.id);
    return json(
      serializeArtwork(created, context.env, context.request.url),
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleError(error, context.request, "create_artwork");
  }
}
