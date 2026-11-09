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
export function resolveFirebaseProjectId(env = process.env) {
  return (
    env.FIREBASE_PROJECT_ID ||
    /^https:\/\/[a-z]+-[a-z]+\d+-([a-z0-9-]+)\.cloudfunctions\.net$/.exec(
      resolveFirebaseFunctionsUrl(env) || "",
    )?.[1] ||
    null
  );
}
