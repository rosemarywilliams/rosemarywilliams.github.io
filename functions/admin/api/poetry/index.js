import { requireAdmin } from "../../../_lib/access.js";
import { HttpError, handleError, json, readJson } from "../../../_lib/http.js";
import { findPoem, serializePoem, validatePoem } from "../../../_lib/poems.js";

function requireDatabase(env) {
  if (!env.DB) {
    throw new HttpError(503, "The site database is not configured.", "database_not_configured");
  }
}

export async function onRequestGet(context) {
  try {
    await requireAdmin(context);
    requireDatabase(context.env);

    const result = await context.env.DB.prepare(
      `SELECT *
       FROM poems
       ORDER BY published_on DESC, created_at DESC
       LIMIT 2000`,
    ).all();

    return json(
      result.results.map(serializePoem),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleError(error, context.request, "list_admin_poems");
  }
}

export async function onRequestPost(context) {
  try {
    await requireAdmin(context);
    requireDatabase(context.env);

    const poem = validatePoem(await readJson(context.request, 64_000));
    if (await findPoem(context.env, poem.id)) {
      throw new HttpError(409, "A poem with this identifier already exists.", "poem_exists");
    }

    await context.env.DB.prepare(
      `INSERT INTO poems (id, title, body, published_on, is_hidden)
       VALUES (?1, ?2, ?3, ?4, ?5)`,
    ).bind(
      poem.id,
      poem.title,
      poem.body,
      poem.publishedOn,
      poem.hidden ? 1 : 0,
    ).run();

    const created = await findPoem(context.env, poem.id);
    return json(
      serializePoem(created),
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleError(error, context.request, "create_poem");
  }
}
