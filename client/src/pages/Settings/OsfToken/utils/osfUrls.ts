const OSF_FUNCTION_BASE = "https://us-central1-test-e4cf9.cloudfunctions.net";

export function getOsfRedirectUri(
  electron: boolean,
  isDev: boolean,
  productionOverride?: string,
) {
  if (electron) return "http://localhost:8888/oauth/osf/callback";
  if (isDev) return "http://localhost:5173/oauth/osf/callback";
  return productionOverride || `${OSF_FUNCTION_BASE}/osfOAuthCallback`;
}

export function getOsfManageUrl(isDev: boolean) {
  return isDev
    ? "http://127.0.0.1:5001/test-e4cf9/us-central1/osfManage"
    : `${OSF_FUNCTION_BASE}/osfManage`;
}

export function getOsfOAuthExchangeUrl(
  isDev: boolean,
  code: string,
  state: string,
  redirectUri: string,
) {
  const baseUrl = isDev
    ? "http://127.0.0.1:5001/test-e4cf9/us-central1/osfOAuthCallback"
    : `${OSF_FUNCTION_BASE}/osfOAuthCallback`;
  return `${baseUrl}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
}
