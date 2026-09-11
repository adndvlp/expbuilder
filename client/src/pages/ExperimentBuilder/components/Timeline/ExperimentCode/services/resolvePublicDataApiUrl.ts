import { buildFunctionsBaseUrl } from "../../../../../../lib/oauthConfig";

/**
 * Resolves the data API URL baked into generated PUBLIC experiments.
 *
 * The build-time env var (`VITE_DATA_API_URL`) freezes one backend into
 * every published page. That breaks members on other backends — and bakes
 * `undefined` when the building app lacks the var, producing pages that
 * POST to GitHub Pages itself (HTTP 405, "failed to create session").
 * Deriving from the ACTIVE backend keeps every publisher correct.
 */
export async function resolvePublicDataApiUrl(options: {
  dev: boolean;
  bakedUrl: string | undefined;
  getBackendProjectId: () => Promise<string | null>;
}): Promise<string | undefined> {
  if (options.dev) return options.bakedUrl;
  try {
    const projectId = await options.getBackendProjectId();
    if (projectId) return `${buildFunctionsBaseUrl(projectId)}/apiData`;
  } catch {
    // Fall through to the baked value below.
  }
  return options.bakedUrl;
}
