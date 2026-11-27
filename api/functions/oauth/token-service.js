import fetch from "../utils/fetch-with-timeout.js";
import { db } from "../app.js";
import { refreshOSFToken } from "./api/callbacks/osf.js";
import { refreshAccessToken } from "./refresh.js";
import { getTokenProvider } from "./token-registry.js";
import { tokenSnapshot, writeCredentials, classifyStoreError } from "./credential-store.js";
import { PROVIDER_ENDPOINTS as endpoints } from "../utils/provider-endpoints.js";

const EXPIRY_MARGIN_MS = 5 * 60 * 1000;

function validTokenResult(accessToken, wasRefreshed = false) {
  return {
    success: true,
    access_token: accessToken,
    wasRefreshed,
  };
}

function notConnectedResult(provider) {
  return {
    success: false,
    error: `User has not connected ${provider}`,
    code: "OAUTH_REAUTH_PENDING",
    retryable: true,
  };
}

async function getValidOsfToken(userRef, userData) {
  const tokenProvider = getTokenProvider("osf");
  const tokensFieldName = tokenProvider.tokensFieldName;
  const tokensObject = userData[tokensFieldName];

  if (tokensObject && tokensObject.access_token) {
    const currentTime = Date.now();
    const expiresAt = tokensObject.expires_at || 0;

    if (expiresAt > currentTime + 5 * 60 * 1000) {
      console.log("Using existing valid OSF OAuth token");
      return validTokenResult(tokensObject.access_token);
    }

    if (tokensObject.refresh_token) {
      console.log("OSF OAuth token expired or about to expire, refreshing...");
      try {
        const refreshResult = await refreshOSFToken(tokensObject.refresh_token);
        const updatedTokens = {
          ...tokensObject,
          access_token: refreshResult.access_token,
          expires_at: refreshResult.expires_at,
        };

        await userRef.update({ [tokensFieldName]: updatedTokens });
        console.log("OSF OAuth token refreshed successfully");
        return validTokenResult(refreshResult.access_token, true);
      } catch (refreshError) {
        console.error("Failed to refresh OSF OAuth token:", refreshError);
      }
    }
  }

  if (userData.osfToken && userData.osfTokenValid) {
    try {
      const checkResp = await fetch(`${endpoints.osf.apiBase}/v2/users/me/`, {
        method: "GET",
        headers: { Authorization: `Bearer ${userData.osfToken}` },
      });
      if (checkResp.ok) {
        console.log("Using manual OSF token as fallback (validated)");
        return validTokenResult(userData.osfToken);
      }
      await userRef.update({ osfTokenValid: false });
      console.warn(
        "Manual OSF token rejected by API; marked invalid in Firestore",
      );
    } catch (checkError) {
      console.warn(
        "Could not validate manual OSF token (network error):",
        checkError.message,
      );
    }
  }

  console.error("User does not have valid OSF token (OAuth or manual)");
  return {
    success: false,
    error: "User has not connected OSF or token is invalid",
  };
}

/**
 * Re-reads credentials after a suspicious refresh failure. Returns null when
 * the stored credentials are unchanged; otherwise reclassifies against the
 * current state: adopt a usable concurrent token, report a local disconnect,
 * or report a temporary condition when a concurrent operation is in flight.
 */
async function reconcileCredentials(userRef, provider, snapshot) {
  try {
    const doc = await userRef.get();
    const tokensFieldName = getTokenProvider(provider).tokensFieldName;
    const tokensObject = doc.exists ? doc.data()[tokensFieldName] : undefined;
    const current = tokenSnapshot(tokensObject);

    if (
      current.state === snapshot.state &&
      current.access_token === snapshot.access_token &&
      current.refresh_token === snapshot.refresh_token &&
      current.expires_at === snapshot.expires_at
    ) {
      return null;
    }

    if (
      current.state === "present" &&
      typeof current.access_token === "string" &&
      current.access_token &&
      Number.isFinite(current.expires_at) &&
      current.expires_at > Date.now() + EXPIRY_MARGIN_MS
    ) {
      console.log(`Adopting ${provider} token written by a concurrent refresh`);
      return validTokenResult(current.access_token);
    }

    if (current.state !== "present") {
      return notConnectedResult(provider);
    }

    return {
      success: false,
      error: `${provider} credentials changed and are not usable yet`,
      code: "OAUTH_TEMPORARY",
      retryable: true,
    };
  } catch (error) {
    console.error("Could not reconcile token state:", error?.code ?? error?.name ?? "store");
    return classifyStoreError(error);
  }
}

async function getValidProviderToken(provider, uid, userRef, userData) {
  const tokenProvider = getTokenProvider(provider);
  if (!tokenProvider?.tokensFieldName) {
    return {
      success: false,
      error: `Unknown provider: ${provider}`,
    };
  }
  const { tokensFieldName } = tokenProvider;
  const tokensObject = userData[tokensFieldName];
  const snapshot = tokenSnapshot(tokensObject);
  const currentTime = Date.now();

  if (
    snapshot.state === "present" &&
    typeof snapshot.access_token === "string" &&
    snapshot.access_token &&
    Number.isFinite(snapshot.expires_at) &&
    snapshot.expires_at > currentTime + EXPIRY_MARGIN_MS
  ) {
    console.log(`Using existing valid ${provider} token`);
    return validTokenResult(snapshot.access_token);
  }

  if (
    snapshot.state !== "present" ||
    typeof snapshot.refresh_token !== "string" ||
    !snapshot.refresh_token
  ) {
    console.error(`User does not have ${provider} tokens`);
    return notConnectedResult(provider);
  }

  console.log(`${provider} token expired or about to expire, refreshing...`);
  const refreshResult = await refreshAccessToken(provider, snapshot.refresh_token);

  if (!refreshResult.success) {
    if (refreshResult.code === "OAUTH_REAUTH_PENDING") {
      // Confirmatory re-read: a concurrent worker may have rotated and
      // persisted new credentials after our failed request.
      const reconciled = await reconcileCredentials(userRef, provider, snapshot);
      if (reconciled) return reconciled;
    }
    return refreshResult;
  }

  const expiresIn = refreshResult.expires_in;
  const newExpiresAt = currentTime + expiresIn * 1000;
  const next = {
    ...(snapshot.state === "present" ? tokensObject : {}),
    access_token: refreshResult.access_token,
    refresh_token: refreshResult.refresh_token || snapshot.refresh_token,
    expires_at: newExpiresAt,
    expires_in: expiresIn,
    token_type: tokensObject?.token_type || "bearer",
  };

  const write = await writeCredentials({
    provider,
    uid,
    expected: snapshot,
    next,
  });

  if (!write.applied) {
    // A concurrent writer (refresh, reconnection or local disconnect) won.
    const reconciled = await reconcileCredentials(userRef, provider, snapshot);
    if (reconciled) return reconciled;
    const storeCode = write.errorCode === "TOKEN_STORE_CONFIGURATION"
      ? "TOKEN_STORE_CONFIGURATION"
      : "TOKEN_STORE_TEMPORARY";
    return {
      success: false,
      error: write.errorCode
        ? "Token storage temporarily unavailable"
        : "Token refresh succeeded but credentials changed concurrently",
      code: storeCode,
      retryable: write.errorCode !== "TOKEN_STORE_CONFIGURATION",
    };
  }

  console.log(`${provider} OAuth token refreshed successfully`);
  return validTokenResult(refreshResult.access_token, true);
}

export async function getValidToken(provider, uid) {
  try {
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.error("User not found:", uid);
      return {
        success: false,
        error: "User not found",
      };
    }

    const userData = userDoc.data();
    if (provider === "osf") {
      return await getValidOsfToken(userRef, userData);
    }

    return await getValidProviderToken(provider, uid, userRef, userData);
  } catch (error) {
    console.error(`Error in getValidToken for ${provider}:`, error?.code ?? error?.name ?? "store");
    // Firestore failures are classified (numeric or symbolic codes) and the
    // response is sanitized: raw error text never reaches the caller.
    return classifyStoreError(error);
  }
}
