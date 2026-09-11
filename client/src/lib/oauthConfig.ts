import { auth } from "./firebase";

export type OAuthProviderKey = "github" | "dropbox" | "googleDrive" | "osf";

const FIELD_KEYS: Record<OAuthProviderKey, keyof OAuthConfig> = {
  github: "githubClientId",
  dropbox: "dropboxClientId",
  googleDrive: "googleDriveClientId",
  osf: "osfClientId",
};

const ENV_KEYS: Record<OAuthProviderKey, string> = {
  github: "VITE_GITHUB_CLIENT_ID",
  dropbox: "VITE_DROPBOX_CLIENT_ID",
  googleDrive: "VITE_GOOGLE_DRIVE_CLIENT_ID",
  osf: "VITE_OSF_CLIENT_ID",
};

export async function getProviderClientId(
  provider: OAuthProviderKey,
): Promise<string | null> {
  const electronApi = window.electron;
  if (electronApi?.readOauthConfig) {
    try {
      const config = await electronApi.readOauthConfig();
      const fromSettings = config?.[FIELD_KEYS[provider]] || null;
      if (fromSettings) return fromSettings;
    } catch {
      return null;
    }
  } else {
    const fromEnv = import.meta.env[ENV_KEYS[provider]] || null;
    if (fromEnv) return fromEnv;
  }
  // Members on a shared server never see the operator's Settings screen:
  // fall back to the public client IDs served by their own backend.
  return getBackendProviderClientId(provider);
}

export async function getBackendProjectId(): Promise<string | null> {
  const electronApi = window.electron;
  if (electronApi?.readFirebaseConfig) {
    try {
      const config = await electronApi.readFirebaseConfig();
      if (config?.projectId) return config.projectId;
    } catch {
      return null;
    }
  }
  return import.meta.env.VITE_FIREBASE_PROJECT_ID || null;
}

export function buildFunctionsBaseUrl(projectId: string): string {
  return `https://us-central1-${projectId}.cloudfunctions.net`;
}

// Backend key names differ from the client-side provider keys.
const BACKEND_KEYS: Record<OAuthProviderKey, string> = {
  github: "github",
  dropbox: "dropbox",
  googleDrive: "googledrive",
  osf: "osf",
};

let backendClientIdsCache: Record<string, string> | null = null;

/** Test-only reset for the backend client-ids cache. */
export function __resetBackendClientIdsCache(): void {
  backendClientIdsCache = null;
}

async function getBackendProviderClientId(
  provider: OAuthProviderKey,
): Promise<string | null> {
  try {
    const user = auth?.currentUser;
    if (!user) return null;
    const projectId = await getBackendProjectId();
    if (!projectId) return null;
    if (!backendClientIdsCache) {
      const functionsBase = import.meta.env.DEV
        ? `http://127.0.0.1:5001/${projectId}/us-central1`
        : buildFunctionsBaseUrl(projectId);
      const idToken = await user.getIdToken();
      const res = await fetch(`${functionsBase}/getOAuthClientIds`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) return null;
      const data = await res.json().catch(() => ({}));
      backendClientIdsCache =
        data && typeof data.clientIds === "object" && data.clientIds !== null
          ? (data.clientIds as Record<string, string>)
          : {};
    }
    return backendClientIdsCache[BACKEND_KEYS[provider]] ?? null;
  } catch {
    return null;
  }
}
