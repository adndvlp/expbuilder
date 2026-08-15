const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

const PARTICIPANT_API = [
  { method: "POST", pattern: /^\/api\/append-result\/[^/]+$/ },
  { method: "PUT", pattern: /^\/api\/append-result\/[^/]+$/ },
  { method: "GET", pattern: /^\/api\/session-results\/[^/]+$/ },
  { method: "POST", pattern: /^\/api\/complete-session\/[^/]+$/ },
  { method: "PATCH", pattern: /^\/api\/rename-session\/[^/]+$/ },
  { method: "POST", pattern: /^\/api\/participant-files\/[^/]+$/ },
  {
    method: "GET",
    pattern: /^\/api\/participant-files-serve\/[^/]+\/[^/]+$/,
  },
];

const PARTICIPANT_ASSETS = [
  /^\/socket\.io(?:\/|$)/,
  /^\/jspsych-bundle\//,
  /^\/dynamicplugin\/dist\//,
  /^\/plugins\//,
  /^\/icon\//,
  /^\/[^/]+\/(?:img|aud|vid|others)\//,
];

function hostnameFromHeader(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("[")) return raw.slice(0, raw.indexOf("]") + 1);
  return raw.split(":")[0].toLowerCase();
}

function forwardedHost(req) {
  const value = req.headers["x-forwarded-host"];
  return Array.isArray(value) ? value[0] : String(value || "").split(",")[0];
}

export function isCloudflareRequest(req) {
  return Boolean(
    req.headers["cf-connecting-ip"] ||
    req.headers["cf-ray"] ||
    req.headers["cf-visitor"],
  );
}

export function isLocalRequest(req) {
  return (
    !isCloudflareRequest(req) &&
    LOCAL_HOSTS.has(hostnameFromHeader(req.headers.host))
  );
}

export function isParticipantRequest(req) {
  if (req.method === "OPTIONS") return true;
  if (PARTICIPANT_ASSETS.some((pattern) => pattern.test(req.path))) return true;
  if (
    req.method === "GET" &&
    /^\/[^/]+\/?$/.test(req.path) &&
    !req.path.startsWith("/api/")
  ) {
    return true;
  }
  const routeAllowed = PARTICIPANT_API.some(
    (route) => route.method === req.method && route.pattern.test(req.path),
  );
  if (!routeAllowed) return false;
  if (req.method === "GET" && req.path.startsWith("/api/session-results/")) {
    return typeof req.query.sessionId === "string" && req.query.sessionId.length > 0;
  }
  return true;
}

export function restrictRemoteAccess(req, res, next) {
  if (isLocalRequest(req) || isParticipantRequest(req)) return next();
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }
  return res.status(404).send("This page doesn't exist.");
}

export function originMatchesRequest(req, origin) {
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    const effectiveHosts = isCloudflareRequest(req)
      ? [forwardedHost(req), req.headers.host].filter(
          (host) => !LOCAL_HOSTS.has(hostnameFromHeader(host)),
        )
      : [req.headers.host];
    const requestHosts = effectiveHosts
      .filter(Boolean)
      .map((host) => String(host).toLowerCase());
    return requestHosts.includes(parsed.host.toLowerCase());
  } catch {
    return false;
  }
}

export function socketOriginAllowed(req, allowedOrigins = []) {
  const origin = req.headers.origin;
  return (
    !origin ||
    allowedOrigins.includes(origin) ||
    originMatchesRequest(req, origin)
  );
}
