import { requireAdmin } from "../../../_lib/access.js";
import { HttpError, handleError, json, readJson } from "../../../_lib/http.js";
import { findPoem, serializePoem, validatePoem } from "../../../_lib/poems.js";

function routeId(context) {
  const value = Array.isArray(context.params.id) ? context.params.id[0] : context.params.id;
  const id = String(value || "").trim();
  if (!/^[a-zA-Z0-9-]{3,80}$/.test(id)) {
    throw new HttpError(400, "The poem identifier is invalid.", "invalid_poem_id");
  }
  return id;
}

function requireDatabase(env) {
  if (!env.DB) {
    throw new HttpError(503, "The site database is not configured.", "database_not_configured");
  }
}

export async function onRequestPut(context) {
  try {
    await requireAdmin(context);
    requireDatabase(context.env);

    const id = routeId(context);
    if (!await findPoem(context.env, id)) {
      throw new HttpError(404, "That poem could not be found.", "poem_not_found");
    }

    const poem = validatePoem(await readJson(context.request, 64_000));
    if (poem.id !== id) {
      throw new HttpError(400, "The poem identifier cannot be changed.", "id_mismatch");
    }

    await context.env.DB.prepare(
      `UPDATE poems SET
        title = ?1,
        body = ?2,
        published_on = ?3,
        is_hidden = ?4,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?5`,
    ).bind(
      poem.title,
      poem.body,
      poem.publishedOn,
      poem.hidden ? 1 : 0,
      id,
    ).run();

    const updated = await findPoem(context.env, id);
    return json(
      serializePoem(updated),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleError(error, context.request, "update_poem");
  }
}

export async function onRequestDelete(context) {
  try {
    await requireAdmin(context);
    requireDatabase(context.env);

    const id = routeId(context);
    if (!await findPoem(context.env, id)) {
      throw new HttpError(404, "That poem could not be found.", "poem_not_found");
    }

    await context.env.DB.prepare("DELETE FROM poems WHERE id = ?1").bind(id).run();
    return json(
      { deleted: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleError(error, context.request, "delete_poem");
  }
}
