export function buildFunctionsBaseUrl(projectId) {
  return `https://us-central1-${String(projectId).trim()}.cloudfunctions.net`;
}

export function resolveFirebaseFunctionsUrl(env = process.env) {
  const explicit = env.FIREBASE_URL;
  if (typeof explicit === "string" && explicit.trim()) {
    return explicit.trim().replace(/\/$/, "");
  }
  const projectId = env.FIREBASE_PROJECT_ID;
  if (typeof projectId === "string" && projectId.trim()) {
    return buildFunctionsBaseUrl(projectId);
  }
  return null;
}
