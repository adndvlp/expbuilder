import { onRequest } from "firebase-functions/v2/https";
import fetch from "../../../utils/fetch-with-timeout.js";
import { db } from "../../../app.js";
import { validateRedirectUri } from "../../utils/redirect-allowlist.js";
import { validateOAuthState } from "../../state-service.js";
import { PROVIDER_ENDPOINTS as endpoints } from "../../../utils/provider-endpoints.js";
import { getFirebaseAppBaseUrl, getOAuthWebAppBaseUrl } from "../../../utils/firebase-urls.js";
import { tokenSnapshot, writeCredentials } from "../../credential-store.js";

// Credenciales de Google OAuth (desde functions/.env)
const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;

// Función para determinar el REDIRECT_URI correcto basado en el request.
// Usa FUNCTIONS_EMULATOR (seteado automáticamente por Firebase Emulator)
// en vez de NODE_ENV (que NO se setea en deploy de Functions v2).
function getRedirectUri(req) {
  // Si viene de la app Electron (puerto 8888)
  if (req.get("referer")?.includes("localhost:8888")) {
    return "http://localhost:8888/callback";
  }
  // Si es emulador local
  if (process.env.FUNCTIONS_EMULATOR === "true") {
    return "http://localhost:5173/google-drive-callback";
  }
  const base = getFirebaseAppBaseUrl() || "http://localhost:5173";
  return `${base}/google-drive-callback`;
}

// Endpoint para el callback de OAuth de Google Drive
export const googleDriveOAuthCallback = onRequest(async (req, res) => {
  // Permitir CORS para desarrollo local
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  const code = req.query.code;
  const rawState = req.query.state;

  if (!code || !rawState) {
    return res.status(400).send("Missing code or state");
  }

  // T-5: signed-state required.
  const stateCheck = await validateOAuthState(rawState, "googledrive");
  if (!stateCheck.ok) {
    return res.status(400).send(`Invalid OAuth state: ${stateCheck.reason}`);
  }
  const uid = stateCheck.uid;
  const stateTs = stateCheck.ts;

  console.log(
    "Received callback with code:",
    code ? "present" : "missing",
    "uid:",
    uid,
  );

  try {
    console.log("Exchanging code for tokens...");

    // Determinar el REDIRECT_URI correcto
    // T-4: validate caller-supplied redirect_uri against allowlist.
    const REDIRECT_URI =
      validateRedirectUri(req.query.redirect_uri) || getRedirectUri(req);
    console.log("Using REDIRECT_URI:", REDIRECT_URI);

    // CAS snapshot tomado antes del intercambio: si el estado de credenciales
    // cambia durante el flujo (otra autorización, refresh o desconexión local
    // con googleDriveTokens: null), el callback aborta y no sobrescribe.
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();
    const currentTokens = userDoc.exists ? userDoc.data().googleDriveTokens : undefined;
    const expected = tokenSnapshot(currentTokens);
    const previousRefreshToken =
      typeof currentTokens?.refresh_token === "string" && currentTokens.refresh_token
        ? currentTokens.refresh_token
        : null;

    // Intercambia el código por tokens
    const tokenRes = await fetch(`${endpoints.googleDrive.tokenUrl}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    // Sin respuestas no exitosas: el error crudo del proveedor no se propaga.
    if (!tokenRes.ok) {
      throw new Error("Google Drive token exchange failed");
    }
    const tokens = await tokenRes.json();
    console.log("Token response:", tokens.access_token ? "Token received" : "No token");

    // Validación estricta y mensajes sanitizados: nunca propagar el error
    // crudo del proveedor ni aceptar tipos inválidos.
    if (typeof tokens.access_token !== "string" || !tokens.access_token) {
      throw new Error("Google Drive token exchange failed");
    }

    // Calcular primero el refresh token efectivo, validando tipo y no-vacío.
    // El anterior se reutiliza únicamente si es válido; sin valor efectivo no
    // existe autorización durable: abortar sin persistir ni comunicar éxito.
    const newRefreshToken =
      typeof tokens.refresh_token === "string" && tokens.refresh_token
        ? tokens.refresh_token
        : null;
    const effectiveRefreshToken = newRefreshToken || previousRefreshToken;
    if (!effectiveRefreshToken) {
      throw new Error("Google Drive did not return a refresh token; connect again");
    }

    // Precedencia entre autorizaciones: el ts firmado del estado OAuth marca
    // el inicio del flujo. Una autorización cuyo flujo comenzó antes o al
    // mismo tiempo que la almacenada no reemplaza a la almacenada.
    if (
      expected.state === "present" &&
      Number.isFinite(expected.authorized_at) &&
      Number.isFinite(stateTs) &&
      stateTs <= expected.authorized_at
    ) {
      throw new Error("A newer authorization already exists; try again");
    }

    // TTL estricto: solo un número finito positivo se acepta; el fallback de
    // autorización inicial (3600 s) aplica únicamente cuando el campo falta o
    // es inválido, y se escribe coherente en expires_in y expires_at.
    const now = Date.now();
    const rawExpiresIn = tokens.expires_in;
    const expires_in =
      typeof rawExpiresIn === "number" &&
      Number.isFinite(rawExpiresIn) &&
      rawExpiresIn > 0 &&
      Number.isFinite(rawExpiresIn * 1000)
        ? rawExpiresIn
        : 3600; // Default: 1 hora (callback only)
    const expires_at = now + expires_in * 1000;

    const next = {
      access_token: tokens.access_token,
      refresh_token: effectiveRefreshToken,
      // O-7: store lower-case canonical "bearer"
      token_type:
        typeof tokens.token_type === "string"
          ? tokens.token_type.toLowerCase()
          : "bearer",
      expires_in,
      expires_at,
      authorized_at: stateTs,
    };
    if (typeof tokens.scope === "string") next.scope = tokens.scope;

    // Guarda los tokens en Firestore con CAS. Un conflicto (p. ej. desconexión
    // local durante el flujo) aborta sin sobrescribir el estado vigente.
    console.log("Saving tokens to Firestore for user:", uid);
    const write = await writeCredentials({ provider: "googledrive", uid, expected, next });
    if (!write.applied) {
      throw new Error("Authorization state changed while connecting; try again");
    }

    console.log("Google Drive tokens saved successfully with expiration!");

    // Redirigir de vuelta según el origen
    // Si viene de Electron, no redirigir (la app ya tiene el resultado)
    const isElectronRequest = req.get("referer")?.includes("localhost:8888");

    if (isElectronRequest) {
      // Responder con JSON para Electron
      return res.status(200).json({
        success: true,
        message: "Google Drive connected successfully",
      });
    }

    const baseUrl = getOAuthWebAppBaseUrl();
    const redirectUrl = `${baseUrl}/settings?status=success&service=google-drive`;

    return res.redirect(redirectUrl);
  } catch (error) {
    // Sanitizado: sin objeto de error completo en logs ni error.message crudo
    // al cliente; solo un mensaje público seguro.
    console.error("Error in googleDriveOAuthCallback:", error?.code ?? error?.name ?? "oauth");
    const publicMessage = "Google Drive connection failed";

    // Verificar si viene de Electron
    const isElectronRequest = req.get("referer")?.includes("localhost:8888");

    if (isElectronRequest) {
      // Responder con JSON para Electron
      return res.status(500).json({
        success: false,
        error: publicMessage,
      });
    }

    const baseUrl = getOAuthWebAppBaseUrl();
    const redirectUrl = `${baseUrl}/settings?status=error&service=google-drive&message=${encodeURIComponent(publicMessage)}`;

    return res.redirect(redirectUrl);
  }
});
