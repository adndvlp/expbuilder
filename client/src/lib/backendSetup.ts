export interface OAuthProviderConfig {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
}

export interface BackendOAuthState {
  github: OAuthProviderConfig;
  dropbox: OAuthProviderConfig;
  googleDrive: OAuthProviderConfig;
  osf: OAuthProviderConfig;
}

export const OAUTH_CALLBACK_URI = "http://localhost:8888/callback";

export const PROVIDER_CONSOLE_URLS: Record<
  keyof BackendOAuthState,
  string
> = {
  github: "https://github.com/settings/developers",
  dropbox: "https://www.dropbox.com/developers/apps",
  googleDrive: "https://console.cloud.google.com/apis/credentials",
  osf: "https://osf.io/settings/applications/",
};

export const PROVIDER_ENV_PREFIXES: Record<
  keyof BackendOAuthState,
  string
> = {
  github: "GITHUB",
  dropbox: "DROPBOX",
  googleDrive: "GOOGLE_DRIVE",
  osf: "OSF",
};

export const PROVIDER_LABELS: Record<keyof BackendOAuthState, string> = {
  github: "GitHub",
  dropbox: "Dropbox",
  googleDrive: "Google Drive",
  osf: "OSF",
};

export function parseLoginUrl(text: string): string | null {
  const match = text.match(/visit this url[^\n]*:\s*(https?:\/\/\S+)/i);
  return match ? match[1].trim() : null;
}

export function parseLoginToken(text: string): string | null {
  const match = text.match(/1\/\/[A-Za-z0-9_-]+/);
  return match ? match[0] : null;
}

export function parseCreatedAppId(text: string): string | null {
  const match = text.match(/Created Firebase App\s+([^\s]+)/);
  return match ? match[1] : null;
}

export function parseSdkConfig(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function buildFirebaseConfig(sdk: Record<string, any>): FirebaseConfig | null {
  const client = sdk?.client?.[0];
  const apiKey = client?.api_key?.[0]?.current_key;
  const appId = client?.client_info?.mobilesdk_app_id;
  const projectId = sdk?.project_info?.project_id;
  if (!apiKey || !appId || !projectId) return null;
  return {
    apiKey,
    authDomain: `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket: sdk.project_info.storage_bucket,
    messagingSenderId: sdk.project_info.project_number,
    appId,
  };
}

export function buildFunctionsEnv(
  projectId: string,
  oauth: BackendOAuthState,
): Record<string, string> {
  const env: Record<string, string> = {
    FIREBASE_PROJECT_ID: projectId,
    FIREBASE_APP_BASE_URL: `https://${projectId}.firebaseapp.com`,
    OSF_OAUTH_CALLBACK_URL: `https://us-central1-${projectId}.cloudfunctions.net/osfOAuthCallback`,
    OSF_POST_AUTH_REDIRECT_URL: OAUTH_CALLBACK_URI,
  };
  for (const [key, prefix] of Object.entries(PROVIDER_ENV_PREFIXES)) {
    const provider = oauth[key as keyof BackendOAuthState];
    if (provider.enabled && provider.clientId && provider.clientSecret) {
      env[`${prefix}_CLIENT_ID`] = provider.clientId;
      env[`${prefix}_CLIENT_SECRET`] = provider.clientSecret;
    }
  }
  return env;
}

export function buildOauthConfig(oauth: BackendOAuthState): OAuthConfig {
  const config: OAuthConfig = {};
  if (oauth.github.enabled && oauth.github.clientId) {
    config.githubClientId = oauth.github.clientId;
  }
  if (oauth.dropbox.enabled && oauth.dropbox.clientId) {
    config.dropboxClientId = oauth.dropbox.clientId;
  }
  if (oauth.googleDrive.enabled && oauth.googleDrive.clientId) {
    config.googleDriveClientId = oauth.googleDrive.clientId;
  }
  if (oauth.osf.enabled && oauth.osf.clientId) {
    config.osfClientId = oauth.osf.clientId;
  }
  return config;
}
