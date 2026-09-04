function trimSlash(url) {
  return url.replace(/\/$/, "");
}

export function getFirebaseProjectId() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  return typeof projectId === "string" && projectId.trim()
    ? projectId.trim()
    : null;
}

export function getFirebaseAppBaseUrl() {
  const explicit = process.env.FIREBASE_APP_BASE_URL;
  if (typeof explicit === "string" && explicit.trim()) {
    return trimSlash(explicit.trim());
  }
  const projectId = getFirebaseProjectId();
  return projectId ? `https://${projectId}.firebaseapp.com` : null;
}

export function getFunctionsBaseUrl() {
  const projectId = getFirebaseProjectId();
  return projectId ? `https://us-central1-${projectId}.cloudfunctions.net` : null;
}

export function getOAuthWebAppBaseUrl() {
  if (process.env.FUNCTIONS_EMULATOR === "true") {
    return "http://localhost:5173";
  }
  return getFirebaseAppBaseUrl() || "";
}
