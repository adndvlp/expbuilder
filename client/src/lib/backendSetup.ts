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

export const EMPTY_OAUTH: BackendOAuthState = {
  github: { enabled: false, clientId: "", clientSecret: "" },
  dropbox: { enabled: false, clientId: "", clientSecret: "" },
  googleDrive: { enabled: false, clientId: "", clientSecret: "" },
  osf: { enabled: false, clientId: "", clientSecret: "" },
};

export const PROVIDER_KEYS = Object.keys(EMPTY_OAUTH) as Array<
  keyof BackendOAuthState
>;

export interface FirebaseProjectOption {
  projectId: string;
  displayName: string;
  projectNumber?: string;
}

export interface BillingAccountOption {
  name: string;
  displayName: string;
  open?: boolean;
}

export interface BackendSetupPersistState {
  projectId?: string;
  token?: string;
  configSaved?: boolean;
  billingDone?: boolean;
  firestoreDone?: boolean;
  authDone?: boolean;
  deployed?: boolean;
  googleAuthNeedsConsole?: boolean;
}

export function parseLoginUrl(text: string): string | null {
  const match = text.match(/visit this url[^\n]*:\s*(https?:\/\/\S+)/i);
  return match ? match[1].trim() : null;
}

export function parseLoginToken(text: string): string | null {
  const match = text.match(/1\/\/[A-Za-z0-9_-]+/);
  return match ? match[0] : null;
}

const ANSI_ESCAPE = /\u001B\[[0-9;]*m/g;
const CI_TOKEN = /1\/\/[A-Za-z0-9_-]+/g;
const NOISY_LOG_LINE =
  /DeprecationWarning: The `punycode` module|Authenticating with a `login:ci` token is deprecated|Instead, use a service account key|Use this token to login on a CI server|Example: firebase deploy --token|trace-deprecation/i;

export function sanitizeBackendLog(text: string): string {
  return text
    .replace(ANSI_ESCAPE, "")
    .replace(CI_TOKEN, "[redacted]")
    .split(/\r?\n/)
    .filter((line) => !NOISY_LOG_LINE.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

export function parseCreatedAppId(text: string): string | null {
  const match =
    text.match(/App ID:\s*(\S+)/i) ||
    text.match(/Created Firebase App\s+(\S+)/) ||
    text.match(/apps:sdkconfig\s+\S+\s+(\S+)/i) ||
    text.match(/"appId"\s*:\s*"([^"]+)"/);
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

export function parseFirebaseJsonResult(text: string): unknown {
  const parsed = parseSdkConfig(text);
  if (!parsed || typeof parsed !== "object") return null;
  if ("status" in parsed) {
    const envelope = parsed as { status?: string; result?: unknown };
    if (envelope.status === "success") return envelope.result ?? null;
    return null;
  }
  return parsed;
}

export function parseListedWebAppId(
  text: string,
  displayName = "ExpBuilder",
): string | null {
  const json = parseFirebaseJsonResult(text);
  if (Array.isArray(json)) {
    const match = [...json]
      .reverse()
      .find(
        (app) =>
          app &&
          typeof app === "object" &&
          "appId" in app &&
          (app as { displayName?: string }).displayName === displayName,
      ) as { appId?: string } | undefined;
    if (match?.appId) return match.appId;
    const anyApp = [...json]
      .reverse()
      .find((app) => app && typeof app === "object" && "appId" in app) as
      | { appId?: string }
      | undefined;
    if (anyApp?.appId) return anyApp.appId;
  }
  const lines = text.split(/\r?\n/).filter((line) => line.includes(displayName));
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const match = lines[i].match(/\d+:[^:\s]+:web:[^\s│|]+/);
    if (match) return match[0];
  }
  return parseCreatedAppId(text);
}

export function oauthStateFromConfig(
  config: OAuthConfig | null | undefined,
): BackendOAuthState {
  const next: BackendOAuthState = {
    github: { ...EMPTY_OAUTH.github },
    dropbox: { ...EMPTY_OAUTH.dropbox },
    googleDrive: { ...EMPTY_OAUTH.googleDrive },
    osf: { ...EMPTY_OAUTH.osf },
  };
  if (!config) return next;
  if (config.githubClientId) {
    next.github = { enabled: true, clientId: config.githubClientId, clientSecret: "" };
  }
  if (config.dropboxClientId) {
    next.dropbox = { enabled: true, clientId: config.dropboxClientId, clientSecret: "" };
  }
  if (config.googleDriveClientId) {
    next.googleDrive = {
      enabled: true,
      clientId: config.googleDriveClientId,
      clientSecret: "",
    };
  }
  if (config.osfClientId) {
    next.osf = { enabled: true, clientId: config.osfClientId, clientSecret: "" };
  }
  return next;
}

export function buildFirebaseConfig(sdk: Record<string, any>): FirebaseConfig | null {
  if (sdk?.apiKey && sdk?.appId && sdk?.projectId) {
    const messagingSenderId = String(
      sdk.messagingSenderId || String(sdk.appId).split(":")[1] || "",
    );
    if (!messagingSenderId) return null;
    return {
      apiKey: sdk.apiKey,
      authDomain: sdk.authDomain || `${sdk.projectId}.firebaseapp.com`,
      projectId: sdk.projectId,
      storageBucket: sdk.storageBucket || `${sdk.projectId}.appspot.com`,
      messagingSenderId,
      appId: sdk.appId,
    };
  }
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
  // Do not write FIREBASE_* keys: firebase-tools rejects them as reserved.
  const env: Record<string, string> = {
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

export function projectSetupArgs(
  projectId: string,
  mode: "create" | "use",
): string[] | null {
  if (mode !== "create") return null;
  return ["projects:create", projectId, "--display-name", projectId];
}

export function functionsDeployOnly(alreadyDeployed: boolean): string {
  return alreadyDeployed ? "functions" : "firestore,functions";
}

export function publishingFingerprint(oauth: BackendOAuthState): string {
  return PROVIDER_KEYS.map((key) => {
    const provider = oauth[key];
    return `${key}:${provider.enabled ? "1" : "0"}:${provider.clientId}:${provider.clientSecret}`;
  }).join("|");
}

export function commandError(
  result: { error: string | null; output: string },
  fallback: string,
): string {
  if (result.error) return result.error;
  if (/Quota exceeded for total allowable CPU/i.test(result.output)) {
    return "Google Cloud ran out of CPU in this region while updating functions. Wait a few minutes and try once. Retrying right away makes the limit worse.";
  }
  const messages = [...result.output.matchAll(/^Error:\s*(.+)$/gm)]
    .map((match) => match[1].trim())
    .filter(Boolean);
  const specific = [...messages]
    .reverse()
    .find((message) => message !== "An unexpected error has occurred.");
  return specific || messages[messages.length - 1] || fallback;
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
