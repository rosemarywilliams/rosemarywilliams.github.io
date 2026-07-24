import { handleError, json } from "../_lib/http.js";
import { serializePoem } from "../_lib/poems.js";

export async function onRequestGet(context) {
  try {
    if (!context.env.DB) {
      throw new Error("The DB binding is missing.");
    }

    const result = await context.env.DB.prepare(
      `SELECT *
       FROM poems
       WHERE is_hidden = 0
       ORDER BY published_on DESC, created_at DESC
       LIMIT 2000`,
    ).all();

    return json(
      result.results.map(serializePoem),
      {
        headers: {
          "Cache-Control": "public, max-age=0, must-revalidate",
        },
      },
    );
  } catch (error) {
    return handleError(error, context.request, "list_public_poems");
  }
}
