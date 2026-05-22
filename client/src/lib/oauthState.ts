import { auth } from "./firebase";

/**
 * T-5: fetch a server-signed OAuth `state` from the backend before redirecting
 * to a provider's OAuth flow.
 *
 * The state encodes `(uid, provider, timestamp, nonce)` and is signed with an
 * HMAC secret held only by the backend. The callback re-derives the HMAC and
 * rejects the request if it doesn't match — closing the previous CSRF vector
 * where `state=uid` could be forged by anyone who knew a target uid.
 *
 * Must be called with a logged-in Firebase user; the endpoint requires
 * `Authorization: Bearer <ID token>` and binds the state to the authed uid.
 */
const FUNCTIONS_BASE = import.meta.env.DEV
  ? "http://127.0.0.1:5001/test-e4cf9/us-central1"
  : "https://us-central1-test-e4cf9.cloudfunctions.net";

export type OAuthProvider = "dropbox" | "googledrive" | "github" | "osf";

export async function fetchOAuthState(provider: OAuthProvider): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Not authenticated — sign in before connecting a provider");
  }
  const idToken = await user.getIdToken();

  const res = await fetch(`${FUNCTIONS_BASE}/createOAuthStateEndpoint`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ provider }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      body.message || `Failed to fetch OAuth state (HTTP ${res.status})`,
    );
  }

  const data = await res.json();
  if (!data.state || typeof data.state !== "string") {
    throw new Error("OAuth state endpoint returned no state");
  }
  return data.state;
}
