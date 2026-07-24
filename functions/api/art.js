import { handleError, json } from "../_lib/http.js";
import { serializeArtwork } from "../_lib/artworks.js";

export async function onRequestGet(context) {
  try {
    if (!context.env.DB) {
      throw new Error("The DB binding is missing.");
    }

    const result = await context.env.DB.prepare(
      `SELECT *
       FROM artworks
       WHERE is_hidden = 0
       ORDER BY sort_order ASC, created_at ASC
       LIMIT 2000`,
    ).all();

    return json(
      result.results.map((row) => serializeArtwork(row, context.env, context.request.url)),
      {
        headers: {
          "Cache-Control": "public, max-age=0, must-revalidate",
        },
      },
    );
  } catch (error) {
    return handleError(error, context.request, "list_public_artworks");
  }
}
