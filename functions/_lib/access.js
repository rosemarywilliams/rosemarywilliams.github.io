import { HttpError } from "./http.js";

const textEncoder = new TextEncoder();

function decodeBase64Url(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJsonSegment(value) {
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
  } catch {
    throw new HttpError(401, "Your administrative session is invalid.", "invalid_access_token");
  }
}

function normalizeTeamDomain(value) {
  const domain = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");

  if (!/^[a-z0-9.-]+\.cloudflareaccess\.com$/.test(domain)) {
    throw new HttpError(
      503,
      "Cloudflare Access has not been configured for this site.",
      "access_not_configured",
    );
  }

  return domain;
}

function allowedEmails(value) {
  return new Set(
    String(value || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.includes("@") && !email.startsWith("replace_")),
  );
}

function audienceMatches(claim, expected) {
  return Array.isArray(claim) ? claim.includes(expected) : claim === expected;
}

export async function requireAdmin(context) {
  const token = context.request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) {
    throw new HttpError(401, "Please sign in through Cloudflare Access.", "authentication_required");
  }

  const expectedAudience = String(context.env.CF_ACCESS_AUD || "").trim();
  const administrators = allowedEmails(context.env.ADMIN_EMAILS);
  if (!expectedAudience || expectedAudience.startsWith("REPLACE_") || administrators.size === 0) {
    throw new HttpError(
      503,
      "The administrative allowlist has not been configured.",
      "access_not_configured",
    );
  }

  const segments = token.split(".");
  if (segments.length !== 3) {
    throw new HttpError(401, "Your administrative session is invalid.", "invalid_access_token");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = segments;
  const header = decodeJsonSegment(encodedHeader);
  const payload = decodeJsonSegment(encodedPayload);
  if (header.alg !== "RS256" || typeof header.kid !== "string") {
    throw new HttpError(401, "Your administrative session is invalid.", "invalid_access_token");
  }

  const teamDomain = normalizeTeamDomain(context.env.CF_ACCESS_TEAM_DOMAIN);
  const certificatesResponse = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`, {
    headers: { Accept: "application/json" },
  });
  if (!certificatesResponse.ok) {
    throw new HttpError(503, "Cloudflare Access verification is temporarily unavailable.", "access_unavailable");
  }

  const certificates = await certificatesResponse.json();
  const signingKey = Array.isArray(certificates.keys)
    ? certificates.keys.find((key) => key.kid === header.kid)
    : null;
  if (!signingKey) {
    throw new HttpError(401, "Your administrative session has expired.", "unknown_signing_key");
  }

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    signingKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const signatureIsValid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    decodeBase64Url(encodedSignature),
    textEncoder.encode(`${encodedHeader}.${encodedPayload}`),
  );
  if (!signatureIsValid) {
    throw new HttpError(401, "Your administrative session is invalid.", "invalid_access_token");
  }

  const now = Math.floor(Date.now() / 1000);
  const expectedIssuer = `https://${teamDomain}`;
  const email = String(payload.email || "").trim().toLowerCase();
  if (
    payload.iss !== expectedIssuer
    || !audienceMatches(payload.aud, expectedAudience)
    || typeof payload.exp !== "number"
    || payload.exp < now - 30
    || (typeof payload.nbf === "number" && payload.nbf > now + 30)
    || !administrators.has(email)
  ) {
    throw new HttpError(403, "This account is not allowed to manage the gallery.", "not_authorized");
  }

  return { email };
}
