import { createHash } from "node:crypto";
import * as backend from "../../app.js";
import fetch from "../../utils/fetch-with-timeout.js";
import { ExperimentAccessError } from "../access.js";

export const bindingError = (code, message, status = 409) =>
  new ExperimentAccessError(code, status, message);
const ordered = (value) =>
  Array.isArray(value)
    ? value.map(ordered)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, ordered(value[key])]),
        )
      : value;
export const hash = (value) =>
  createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(ordered(value)))
    .digest("hex");
export function backendProjectId() {
  const id = backend.app?.options?.projectId || process.env.GCLOUD_PROJECT;
  if (!id)
    throw bindingError(
      "BACKEND_UNAVAILABLE",
      "Backend project identity is unavailable.",
      503,
    );
  return id;
}
export function identityMarker(experimentID) {
  return {
    format: "expbuilder",
    schemaVersion: 1,
    backendProjectId: backendProjectId(),
    experimentID,
  };
}
export function checkMarker(marker, experimentID, code) {
  if (
    marker?.format !== "expbuilder" ||
    marker.backendProjectId !== backendProjectId() ||
    marker.experimentID !== experimentID
  ) {
    throw bindingError(
      code,
      "This resource is marked for a different experiment or backend project.",
    );
  }
}
function providerRateLimit(response, data) {
  const message = [
    data?.message,
    data?.error?.message,
    ...(data?.error?.errors || []).map((error) => error.reason),
  ]
    .filter(Boolean)
    .join(" ");
  return (
    response.status === 429 ||
    (response.status === 403 &&
      (response.headers?.get?.("x-ratelimit-remaining") === "0" ||
        Boolean(response.headers?.get?.("retry-after")) ||
        /rate[ _-]*limit|quota|too many requests/i.test(message)))
  );
}
export async function jsonRequest(
  url,
  {
    token,
    method = "GET",
    body,
    rawBody,
    headers = {},
    allowMissing = false,
    code = "PROVIDER_UNAVAILABLE",
  } = {},
) {
  const destination = code.startsWith("STORAGE")
    ? "data destination"
    : code.startsWith("GITHUB")
      ? "GitHub destination"
      : "selected resource";
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(body !== undefined && { "Content-Type": "application/json" }),
        ...headers,
      },
      ...(body !== undefined
        ? { body: JSON.stringify(body) }
        : rawBody !== undefined
          ? { body: rawBody }
          : {}),
    });
  } catch {
    throw bindingError(
      code,
      `The ${destination} could not be reached. Retry checking the account and connection.`,
      503,
    );
  }
  if (allowMissing && response.status === 404) return null;
  if (response.ok && response.status === 204) return {};
  const data = await response.json().catch(() => null);
  if (!response.ok || data === null) {
    const error = bindingError(
      code,
      `The ${destination} could not be verified. Check the linked account and permissions, then retry.`,
      providerRateLimit(response, data)
        ? 503
        : response.status >= 500
          ? 502
          : 409,
    );
    error.providerStatus = response.status;
    Object.defineProperty(error, "providerBody", { value: data });
    throw error;
  }
  return data;
}
export function scalarID(value, code) {
  if (!["string", "number"].includes(typeof value) || !String(value).trim())
    throw bindingError(
      code,
      "The provider returned no stable resource identity.",
    );
  return String(value);
}
export const resourceName = (experimentID) =>
  /^[A-Za-z0-9_-]{1,80}$/.test(experimentID)
    ? experimentID
    : hash(experimentID).slice(0, 32);
