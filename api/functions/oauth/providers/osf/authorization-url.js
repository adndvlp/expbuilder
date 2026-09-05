import { CLIENT_ID, getRedirectUri } from "./config.js";
import { PROVIDER_ENDPOINTS as endpoints } from "../../../utils/provider-endpoints.js";

/**
 * Función helper para iniciar el flujo de OAuth de OSF
 * Esta función genera la URL de autorización
 */
export function getOSFAuthorizationUrl(uid) {
  const authUrl = new URL(`${endpoints.osf.authorizeUrl}`);
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("client_id", CLIENT_ID);
  authUrl.searchParams.append("redirect_uri", getRedirectUri());
  authUrl.searchParams.append("scope", "osf.full_read osf.full_write");
  authUrl.searchParams.append("access_type", "offline"); // Para obtener refresh token
  authUrl.searchParams.append("approval_prompt", "auto");
  authUrl.searchParams.append("state", uid); // Usar el UID como state para CSRF protection

  return authUrl.toString();
}
