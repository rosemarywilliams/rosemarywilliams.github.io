import { HttpError } from "./http.js";

function cleanId(value) {
  const id = String(value || "").trim();
  if (!/^[a-zA-Z0-9-]{3,80}$/.test(id)) {
    throw new HttpError(400, "The poem identifier is invalid.", "invalid_poem");
  }
  return id;
}

function cleanTitle(value) {
  const title = String(value ?? "").trim();
  if (!title) {
    throw new HttpError(400, "Title is required.", "invalid_poem");
  }
  if (title.length > 160) {
    throw new HttpError(400, "Title is too long.", "invalid_poem");
  }
  return title;
}

function cleanBody(value) {
  const body = String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/^\n+|\s+$/g, "");
  if (!body) {
    throw new HttpError(400, "Poem text is required.", "invalid_poem");
  }
  if (body.length > 20_000) {
    throw new HttpError(400, "Poem text is too long.", "invalid_poem");
  }
  return body;
}

function cleanPublishedOn(value) {
  const publishedOn = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(publishedOn)) {
    throw new HttpError(400, "Publication date is required.", "invalid_poem");
  }

  const parsed = new Date(`${publishedOn}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== publishedOn) {
    throw new HttpError(400, "Publication date is invalid.", "invalid_poem");
  }
  return publishedOn;
}

function cleanBoolean(value) {
  return value === true || value === 1 || value === "1";
}

export function validatePoem(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "Poem data is required.", "invalid_poem");
  }

  return {
    id: cleanId(value.id),
    title: cleanTitle(value.title),
    body: cleanBody(value.body),
    publishedOn: cleanPublishedOn(value.publishedOn),
    hidden: cleanBoolean(value.hidden),
  };
}

export function serializePoem(row) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    publishedOn: row.published_on,
    hidden: row.is_hidden === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findPoem(env, id) {
  return env.DB.prepare("SELECT * FROM poems WHERE id = ?1").bind(id).first();
}
