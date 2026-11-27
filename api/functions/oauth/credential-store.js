import { db } from "../app.js";
import { getTokenProvider } from "./token-registry.js";

/**
 * Credential persistence with compare-and-swap semantics.
 *
 * Callers base a decision (refresh, OAuth callback) on a snapshot of the
 * provider token map; `writeCredentials` only writes when the current map
 * still equals that snapshot. This prevents stale responses (successful or
 * failed) from overwriting newer credentials, including local disconnects
 * that store the token map as `null`.
 *
 * Never performs external fetches inside the transaction.
 */
/**
 * Credential snapshot semantics: `null` (local disconnect) is a distinct
 * state from a missing map (never connected). CAS comparisons include the
 * state so a late callback cannot silently restore disconnected credentials.
 * `authorized_at` carries the signed OAuth state timestamp of the last
 * authorization, enabling precedence between concurrent authorizations.
 */
export function tokenSnapshot(tokensObject) {
  if (tokensObject === null) {
    return { state: "disconnected", access_token: null, refresh_token: null, expires_at: null, authorized_at: null };
  }
  if (tokensObject === undefined || typeof tokensObject !== "object") {
    return { state: "absent", access_token: null, refresh_token: null, expires_at: null, authorized_at: null };
  }
  return {
    state: "present",
    access_token: tokensObject.access_token ?? null,
    refresh_token: tokensObject.refresh_token ?? null,
    expires_at: tokensObject.expires_at ?? null,
    authorized_at: tokensObject.authorized_at ?? null,
  };
}

function snapshotsEqual(a, b) {
  return (
    a.state === b.state &&
    a.access_token === b.access_token &&
    a.refresh_token === b.refresh_token &&
    a.expires_at === b.expires_at &&
    a.authorized_at === b.authorized_at
  );
}

const STORE_ERROR_SIGNALS = {
  1: "cancelled",
  4: "deadline-exceeded",
  7: "permission-denied",
  8: "resource-exhausted",
  9: "failed-precondition",
  10: "aborted",
  13: "internal",
  14: "unavailable",
};
const TEMPORARY_STORE_SIGNALS = new Set([
  "cancelled",
  "deadline-exceeded",
  "resource-exhausted",
  "failed-precondition",
  "aborted",
  "internal",
  "unavailable",
]);

/**
 * Classifies Firestore failures accepting numeric gRPC codes (14, 4, 10, 7…)
 * and symbolic codes ('unavailable', 'deadline-exceeded', 'permission-denied'…).
 * Never leaks raw error text into the result; logs keep the detail.
 */
export function classifyStoreError(error) {
  const raw = error?.code;
  const signal =
    typeof raw === "number"
      ? STORE_ERROR_SIGNALS[raw] || "unknown"
      : String(raw || "").toLowerCase();
  const text = String(error?.message || "").toLowerCase();
  if (signal === "permission-denied" || text.includes("permission denied")) {
    return {
      success: false,
      error: "Token storage configuration requires attention",
      code: "TOKEN_STORE_CONFIGURATION",
      retryable: false,
    };
  }
  if (TEMPORARY_STORE_SIGNALS.has(signal) || TEMPORARY_STORE_SIGNALS.has(text)) {
    return {
      success: false,
      error: "Token storage temporarily unavailable",
      code: "TOKEN_STORE_TEMPORARY",
      retryable: true,
    };
  }
  return {
    success: false,
    error: "Token storage temporarily unavailable",
    code: "TOKEN_STORE_UNKNOWN",
    retryable: true,
  };
}

function withoutUndefined(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  );
}

/**
 * @returns {Promise<{applied: boolean, errorCode?: string}>}
 */
export async function writeCredentials({ provider, uid, expected, next }) {
  const tokenProvider = getTokenProvider(provider);
  if (!tokenProvider?.tokensFieldName) {
    return { applied: false, errorCode: "OAUTH_CONFIGURATION" };
  }
  const { tokensFieldName } = tokenProvider;
  const ref = db.collection("users").doc(uid);

  try {
    return await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(ref);
      const current = doc.exists ? doc.data()[tokensFieldName] : undefined;
      if (!snapshotsEqual(tokenSnapshot(current), expected)) {
        return { applied: false, current: tokenSnapshot(current) };
      }
      await transaction.set(
        ref,
        { [tokensFieldName]: withoutUndefined(next) },
        { merge: true },
      );
      return { applied: true };
    });
  } catch (error) {
    console.error("writeCredentials failed:", error?.code ?? error?.name ?? "store");
    const classified = classifyStoreError(error);
    return { applied: false, errorCode: classified.code };
  }
}
