import { onRequest } from "firebase-functions/v2/https";
import { requireAuth } from "../../utils/auth.js";

/**
 * Authenticated endpoint returning the PUBLIC OAuth client IDs configured
 * on this backend (one per provider that the operator set up).
 *
 * Why it exists: members who join through a shared-server connection code
 * only receive the Firebase config — they never see the operator's
 * Settings > Server screen where OAuth client IDs live. Without this,
 * their "Connect" buttons fail with "OAuth is not configured" even though
 * the shared backend is fully capable. Client IDs are public by design
 * (they travel inside provider authorize URLs); client SECRETS never leave
 * the backend — this endpoint must never return them.
 *
 * Request (GET):
 *   Authorization: Bearer <Firebase ID token>
 *
 * Response:
 *   { success: true, clientIds: { dropbox?, googledrive?, github?, osf? } }
 * Only providers with a configured client ID are included.
 */
export const getOAuthClientIds = onRequest({ cors: true }, async (req, res) => {
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ success: false, message: "Method not allowed" });
    return;
  }

  const uid = await requireAuth(req, res, { requireMatchingUid: false });
  if (!uid) return;

  const configured = {
    dropbox: process.env.DROPBOX_CLIENT_ID,
    googledrive: process.env.GOOGLE_DRIVE_CLIENT_ID,
    github: process.env.GITHUB_CLIENT_ID,
    osf: process.env.OSF_CLIENT_ID,
  };
  const clientIds = Object.fromEntries(
    Object.entries(configured).filter(
      ([, value]) => typeof value === "string" && value.length > 0,
    ),
  );
  res.status(200).json({ success: true, clientIds });
});
