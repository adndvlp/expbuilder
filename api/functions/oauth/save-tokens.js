import { db } from "../app.js";
import { getTokenProvider } from "./token-registry.js";
import { tokenSnapshot, writeCredentials } from "./credential-store.js";

export async function saveTokens(
  provider,
  uid,
  accessToken,
  refreshToken,
  expiresIn,
) {
  try {
    const tokenProvider = getTokenProvider(provider);
    if (!tokenProvider?.tokensFieldName) {
      return { success: false, error: `Unknown provider: ${provider}` };
    }
    const { tokensFieldName } = tokenProvider;

    if (
      typeof accessToken !== "string" ||
      !accessToken ||
      typeof expiresIn !== "number" ||
      !Number.isFinite(expiresIn) ||
      expiresIn <= 0 ||
      !Number.isFinite(expiresIn * 1000)
    ) {
      return { success: false, error: "Tokens are incomplete" };
    }

    const userRef = db.collection("users").doc(uid);
    const doc = await userRef.get();
    const current = doc.exists ? doc.data()[tokensFieldName] : undefined;
    const expected = tokenSnapshot(current);

    // T11: si el refresh token nuevo se omite, se conserva el anterior válido.
    const previousRefreshToken =
      expected.state === "present" &&
      typeof expected.refresh_token === "string" &&
      expected.refresh_token
        ? expected.refresh_token
        : null;
    const effectiveRefreshToken =
      typeof refreshToken === "string" && refreshToken
        ? refreshToken
        : previousRefreshToken;
    if (!effectiveRefreshToken) {
      // Sin refresh token nuevo ni anterior no existe autorización durable.
      return { success: false, error: "Tokens are incomplete" };
    }

    const expiresAt = Date.now() + expiresIn * 1000;
    const next = {
      ...(current ?? {}),
      access_token: accessToken,
      refresh_token: effectiveRefreshToken,
      expires_at: expiresAt,
      expires_in: expiresIn,
      token_type: "bearer",
    };

    const write = await writeCredentials({ provider, uid, expected, next });
    if (!write.applied) {
      // First-committed wins: never overwrite a concurrent authorization,
      // refresh result or local disconnect (map = null).
      const error =
        write.errorCode === "TOKEN_STORE_CONFIGURATION"
          ? "Token storage configuration requires attention"
          : write.errorCode === "TOKEN_STORE_TEMPORARY"
            ? "Token storage temporarily unavailable"
            : "Credentials changed concurrently; retry";
      return { success: false, error };
    }

    console.log(`${provider} tokens saved successfully for user:`, uid);
    return {
      success: true,
      message: "Tokens saved successfully",
    };
  } catch (error) {
    console.error(`Error saving ${provider} tokens:`, error?.code ?? error?.name ?? "store");
    return {
      success: false,
      error: "Token storage temporarily unavailable",
    };
  }
}
