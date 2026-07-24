export class HttpError extends Error {
  constructor(status, message, code = "request_error") {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

export function json(data, options = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("X-Content-Type-Options", "nosniff");

  return new Response(JSON.stringify(data), {
    ...options,
    headers,
  });
}

export function handleError(error, request, action) {
  if (error instanceof HttpError) {
    return json(
      { error: error.message, code: error.code },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  const errorMessage = error instanceof Error ? error.message : String(error);
  if (/no such table:\s*(artworks|media_objects)/i.test(errorMessage)) {
    return json(
      {
        error: "The gallery database has not been initialized.",
        code: "database_not_initialized",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  console.error(JSON.stringify({
    message: "Gallery request failed",
    action,
    path: new URL(request.url).pathname,
    error: errorMessage,
  }));

  return json(
    { error: "The gallery service encountered an unexpected error.", code: "internal_error" },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}

export async function readJson(request, maximumBytes = 32_000) {
  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new HttpError(415, "This endpoint accepts JSON.", "unsupported_media_type");
  }

  const declaredSize = Number(request.headers.get("Content-Length") || 0);
  if (declaredSize > maximumBytes) {
    throw new HttpError(413, "The submitted data is too large.", "payload_too_large");
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maximumBytes) {
    throw new HttpError(413, "The submitted data is too large.", "payload_too_large");
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "The submitted JSON is not valid.", "invalid_json");
  }
}
