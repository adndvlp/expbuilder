const LOCAL_API_URL = "http://localhost:3000";

function trimTrailingSlash(url: string) {
  return url.replace(/\/$/, "");
}

export function getApiBaseUrl(): string {
  if (typeof window !== "undefined" && window.electron?.getApiBaseUrl) {
    const fromElectron = window.electron.getApiBaseUrl();
    if (typeof fromElectron === "string" && fromElectron.length > 0) {
      return trimTrailingSlash(fromElectron);
    }
  }
  const fromEnv = import.meta.env?.VITE_API_URL;
  if (typeof fromEnv === "string" && fromEnv.length > 0) {
    return trimTrailingSlash(fromEnv);
  }
  return LOCAL_API_URL;
}
