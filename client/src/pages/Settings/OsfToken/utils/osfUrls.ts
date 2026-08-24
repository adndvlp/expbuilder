export function getOsfRedirectUri(
  electron: boolean,
  isDev: boolean,
  productionOverride?: string,
) {
  if (electron) return "http://localhost:8888/oauth/osf/callback";
  if (isDev) return "http://localhost:5173/oauth/osf/callback";
  return productionOverride || "http://localhost:8888/callback";
}

export function getOsfManageUrl(isDev: boolean, projectId: string) {
  return isDev
    ? `http://127.0.0.1:5001/${projectId}/us-central1/osfManage`
    : `https://us-central1-${projectId}.cloudfunctions.net/osfManage`;
}

export function getOsfOAuthExchangeUrl(
  isDev: boolean,
  code: string,
  state: string,
  redirectUri: string,
  projectId: string,
) {
  const baseUrl = isDev
    ? `http://127.0.0.1:5001/${projectId}/us-central1/osfOAuthCallback`
    : `https://us-central1-${projectId}.cloudfunctions.net/osfOAuthCallback`;
  return `${baseUrl}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
}
