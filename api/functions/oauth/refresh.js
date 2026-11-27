import fetch from "../utils/fetch-with-timeout.js";
import { getTokenProvider } from "./token-registry.js";

const TRANSIENT_HTTP_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const KNOWN_OAUTH_ERRORS = new Set([
  "invalid_grant",
  "invalid_client",
  "unauthorized_client",
  "temporarily_unavailable",
  "server_error",
  "rate_limit_exceeded",
]);

function failure(error, code, retryable, extra = {}) {
  return { success: false, error, code, retryable, ...extra };
}

function sanitizeOAuthError(value) {
  return typeof value === "string" && KNOWN_OAUTH_ERRORS.has(value)
    ? value
    : null;
}

/**
 * Refreshes an OAuth access token for a generic provider (googledrive, dropbox).
 *
 * Success shape:
 *   { success: true, access_token, expires_in, ...(refresh_token) }
 * Failure shape:
 *   { success: false, error, code, retryable, httpStatus?, oauthError? }
 *
 * Codes: OAUTH_TEMPORARY, OAUTH_INVALID_RESPONSE, OAUTH_REAUTH_PENDING,
 * OAUTH_CONFIGURATION, OAUTH_UNKNOWN. `error` is always a safe message:
 * upstream bodies/descriptions are never leaked to callers.
 */
export async function refreshAccessToken(provider, refreshToken) {
  const tokenProvider = getTokenProvider(provider);
  if (!tokenProvider?.config) {
    return failure(`Unknown provider: ${provider}`, "OAUTH_CONFIGURATION", false);
  }
  const { config } = tokenProvider;
  if (!config.clientId || !config.clientSecret) {
    return failure(
      "Storage OAuth configuration requires attention",
      "OAUTH_CONFIGURATION",
      false,
    );
  }

  console.log(`Refreshing ${provider} token...`);

  let tokenRes;
  try {
    tokenRes = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });
  } catch (error) {
    console.error(
      `Error refreshing ${provider} token:`,
      error?.code || error?.name || "network",
    );
    return failure(
      "Storage credentials temporarily unavailable",
      "OAUTH_TEMPORARY",
      true,
    );
  }

  const httpStatus = tokenRes.status;
  const parseBody = async () => {
    try {
      return await tokenRes.json();
    } catch {
      return null;
    }
  };

  // Precedence rule: classify by HTTP status before parsing the body.
  // Every 5xx is transient per the SDD, not just the enumerated ones.
  if (TRANSIENT_HTTP_STATUS.has(httpStatus) || (httpStatus >= 500 && httpStatus <= 599)) {
    const body = await parseBody();
    const oauthError = sanitizeOAuthError(body?.error);
    return failure(
      "Storage credentials temporarily unavailable",
      "OAUTH_TEMPORARY",
      true,
      { httpStatus, ...(oauthError && { oauthError }) },
    );
  }

  const body = await parseBody();

  if (!tokenRes.ok) {
    const oauthError = body?.error;
    if (oauthError === "invalid_grant") {
      // Never assume permanent revocation on a single invalid_grant: a
      // concurrent refresh with token rotation can produce this while the
      // winning worker has not persisted its credentials yet. Classified
      // retryable; the export attempt budget decides when to stop.
      return failure(
        "Storage authorization may need to be reconnected",
        "OAUTH_REAUTH_PENDING",
        true,
        { httpStatus, oauthError },
      );
    }
    if (oauthError === "invalid_client" || oauthError === "unauthorized_client") {
      return failure(
        "Storage OAuth configuration requires attention",
        "OAUTH_CONFIGURATION",
        false,
        { httpStatus, oauthError },
      );
    }
    return failure(
      "Storage authorization failed temporarily",
      "OAUTH_UNKNOWN",
      true,
      { httpStatus, ...(sanitizeOAuthError(oauthError) && { oauthError: sanitizeOAuthError(oauthError) }) },
    );
  }

  if (!body || typeof body.access_token !== "string" || !body.access_token) {
    return failure(
      "Storage token response was invalid",
      "OAUTH_INVALID_RESPONSE",
      true,
      { httpStatus },
    );
  }

  // Strict TTL validation: only a finite positive number is accepted.
  // Booleans, arrays, strings and non-finite values are rejected (the SDD
  // forbids inventing a TTL during refresh).
  const expiresIn = body.expires_in;
  if (
    typeof expiresIn !== "number" ||
    !Number.isFinite(expiresIn) ||
    expiresIn <= 0 ||
    !Number.isFinite(expiresIn * 1000)
  ) {
    return failure(
      "Storage token response was invalid",
      "OAUTH_INVALID_RESPONSE",
      true,
      { httpStatus },
    );
  }

  const result = { success: true, access_token: body.access_token, expires_in: expiresIn };
  if (typeof body.refresh_token === "string" && body.refresh_token) {
    result.refresh_token = body.refresh_token;
  }

  console.log(`${provider} token refreshed successfully`);
  return result;
}
