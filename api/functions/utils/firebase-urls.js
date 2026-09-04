function trimSlash(url) {
  return url.replace(/\/$/, "");
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function projectIdFromFirebaseConfig() {
  const raw = process.env.FIREBASE_CONFIG;
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    return firstNonEmpty(parsed?.projectId);
  } catch {
    return null;
  }
}

export function getFirebaseProjectId() {
  // FIREBASE_* cannot live in functions/.env (reserved by firebase-tools).
  // Cloud Functions injects GCLOUD_PROJECT / FIREBASE_CONFIG at runtime.
  return firstNonEmpty(
    process.env.FIREBASE_PROJECT_ID,
    process.env.GCLOUD_PROJECT,
    process.env.GCP_PROJECT,
    projectIdFromFirebaseConfig(),
  );
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
