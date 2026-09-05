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
      return config?.[FIELD_KEYS[provider]] || null;
    } catch {
      return null;
    }
  }
  return import.meta.env[ENV_KEYS[provider]] || null;
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
