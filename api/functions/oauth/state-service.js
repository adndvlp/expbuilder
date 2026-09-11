import crypto from "node:crypto";
import { db } from "../app.js";

/**
 * T-5: server-signed OAuth `state` parameter to prevent CSRF / login-fixation.
 *
 * The OAuth `state` was previously set to the authenticated user's UID,
 * which any third party who learned (or guessed) a uid could replay — the
 * attacker could craft an OAuth URL with `state=<victim_uid>` and have the
 * provider deposit ATTACKER tokens onto the VICTIM's user document.
 *
 * Fix: backend mints state as
 *   base64url({ uid, provider, ts, nonce, sig })
 * where `sig = HMAC-SHA256(secret, uid|provider|ts|nonce)`. The OAuth
 * provider returns this state untouched in the callback; the backend
 * re-derives the HMAC, checks `ts` is within 10 minutes, and only then
 * accepts the uid as the actor.
 *
 * The HMAC secret resolves, in order, from:
 *   1. env var `OAUTH_STATE_SECRET` (explicit operator override),
 *   2. a dev-only fallback when running under the Functions emulator,
 *   3. a self-provisioned random secret persisted in Firestore.
 *
 * Case 3 is what researchers and self-hosted operators hit: the first
 * backend call mints a random secret and stores it where only backend code
 * can read it, so OAuth works with zero configuration and zero redeploys.
 * The Firestore document intentionally matches NO `firestore.rules` stanza
 * (default deny for clients); only the Admin SDK used here bypasses rules.
 */

const TEN_MIN_MS = 10 * 60 * 1000;

const DEV_FALLBACK_SECRET = "dev-only-oauth-state-secret-DO-NOT-USE-IN-PROD";
const SERVER_CONFIG_COLLECTION = "_serverConfig";
const OAUTH_STATE_DOC_ID = "oauthState";

function isEmulator() {
  return process.env.FUNCTIONS_EMULATOR === "true";
}

async function getOrCreateSecret() {
  const configured = process.env.OAUTH_STATE_SECRET;
  if (configured) return configured;
  if (isEmulator()) return DEV_FALLBACK_SECRET;

  const ref = db
    .collection(SERVER_CONFIG_COLLECTION)
    .doc(OAUTH_STATE_DOC_ID);
  const existing = await ref.get();
  const stored = existing.exists ? existing.data()?.secret : null;
  if (typeof stored === "string" && stored.length > 0) return stored;

  // First backend call: mint and persist. The transaction keeps exactly one
  // winner; every instance re-reads afterwards, so even a lost race ends up
  // on the canonical stored value.
  const fresh = crypto.randomBytes(32).toString("base64");
  await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    const current = snap.exists ? snap.data()?.secret : null;
    if (typeof current === "string" && current.length > 0) return;
    t.set(
      ref,
      { secret: fresh, createdAt: new Date().toISOString() },
      { merge: true },
    );
  });
  const canonical = await ref.get();
  const canonicalSecret = canonical.exists
    ? canonical.data()?.secret
    : null;
  return typeof canonicalSecret === "string" && canonicalSecret.length > 0
    ? canonicalSecret
    : fresh;
}

function signWith(secret, uid, provider, ts, nonce) {
  return crypto
    .createHmac("sha256", secret)
    .update(`${uid}|${provider}|${ts}|${nonce}`)
    .digest("base64url");
}

/**
 * Mint a signed state for `uid` initiating OAuth with `provider`.
 * @param {string} uid
 * @param {string} provider - "dropbox" | "googledrive" | "github" | "osf"
 * @returns {Promise<string>} base64url-encoded JSON
 */
export async function createOAuthState(uid, provider) {
  if (typeof uid !== "string" || uid.length === 0) {
    throw new Error("createOAuthState: uid required");
  }
  if (typeof provider !== "string" || provider.length === 0) {
    throw new Error("createOAuthState: provider required");
  }
  const ts = Date.now();
  const nonce = crypto.randomBytes(16).toString("base64url");
  const sig = signWith(await getOrCreateSecret(), uid, provider, ts, nonce);
  const payload = { uid, provider, ts, nonce, sig };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

/**
 * Validate a `state` parameter coming back from an OAuth provider.
 * @param {string} stateParam
 * @param {string} expectedProvider
 * @returns {Promise<{ok: true, uid: string}|{ok: false, reason: string}>}
 */
export async function validateOAuthState(stateParam, expectedProvider) {
  if (typeof stateParam !== "string" || stateParam.length === 0) {
    return { ok: false, reason: "missing state" };
  }
  let payload;
  try {
    payload = JSON.parse(
      Buffer.from(stateParam, "base64url").toString("utf8"),
    );
  } catch {
    return { ok: false, reason: "state not base64url JSON" };
  }
  const { uid, provider, ts, nonce, sig } = payload || {};
  if (!uid || !provider || !ts || !nonce || !sig) {
    return { ok: false, reason: "state payload incomplete" };
  }
  if (provider !== expectedProvider) {
    return { ok: false, reason: "provider mismatch" };
  }
  if (Date.now() - ts > TEN_MIN_MS) {
    return { ok: false, reason: "state expired" };
  }
  const expectedSig = signWith(
    await getOrCreateSecret(),
    uid,
    provider,
    ts,
    nonce,
  );
  // Timing-safe comparison
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "invalid HMAC" };
  }
  return { ok: true, uid };
}
