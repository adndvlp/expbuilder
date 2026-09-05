function envOr(name, fallback) {
  const value = process.env[name];
  if (!value) return fallback;
  return value.replace(/\/+$/, "");
}

export const PROVIDER_ENDPOINTS = {
  github: {
    apiBase: envOr("GITHUB_API_BASE", "https://api.github.com"),
    tokenUrl: envOr(
      "GITHUB_OAUTH_TOKEN_URL",
      "https://github.com/login/oauth/access_token",
    ),
  },
  dropbox: {
    apiBase: envOr("DROPBOX_API_BASE", "https://api.dropboxapi.com"),
    contentBase: envOr(
      "DROPBOX_CONTENT_BASE",
      "https://content.dropboxapi.com",
    ),
    tokenUrl: envOr("DROPBOX_TOKEN_URL", "https://api.dropbox.com/oauth2/token"),
  },
  googleDrive: {
    apiBase: envOr("GOOGLE_DRIVE_API_BASE", "https://www.googleapis.com"),
    tokenUrl: envOr("GOOGLE_OAUTH_TOKEN_URL", "https://oauth2.googleapis.com/token"),
  },
  osf: {
    apiBase: envOr("OSF_API_BASE", "https://api.osf.io"),
    tokenUrl: envOr("OSF_TOKEN_URL", "https://accounts.osf.io/oauth2/token"),
    authorizeUrl: envOr(
      "OSF_AUTHORIZE_URL",
      "https://accounts.osf.io/oauth2/authorize",
    ),
  },
};
