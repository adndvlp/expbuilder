import {
  AuthoringRequestError,
  createJsonTransport,
  type FetchLike,
} from "../experiment-authoring/http";

export type ArtifactBuildStage = "saving" | "building";

export type ExperimentArtifactResult = {
  success: true;
  experimentUrl: string;
  message?: string;
};

export class ArtifactBuildError extends Error {
  readonly stage: ArtifactBuildStage;
  readonly reason: "http" | "rejected";

  constructor(
    message: string,
    stage: ArtifactBuildStage,
    reason: "http" | "rejected",
  ) {
    super(message);
    this.name = "ArtifactBuildError";
    this.stage = stage;
    this.reason = reason;
  }
}

function mapRequestError(
  error: unknown,
  stage: ArtifactBuildStage,
): never {
  if (!(error instanceof AuthoringRequestError)) throw error;
  const suffix = stage === "building" ? " when running experiment" : "";
  throw new ArtifactBuildError(
    `Server responded with status: ${error.status}${suffix}`,
    stage,
    "http",
  );
}

export async function buildExperimentArtifact(options: {
  experimentId: string | undefined;
  generatedCode: string;
  apiBaseUrl?: string;
  fetchImpl?: FetchLike;
  saveConfiguration?: boolean;
  isDevMode?: boolean;
  canvasStyles?: unknown;
  onStage?: (stage: ArtifactBuildStage) => void;
}): Promise<ExperimentArtifactResult> {
  if (!options.experimentId) throw new Error("Experiment ID is required");
  if (!options.generatedCode.trim()) throw new Error("Generated code is empty");
  const transport = createJsonTransport({
    baseUrl: options.apiBaseUrl,
    fetchImpl: options.fetchImpl,
  });
  const requestOptions = (body: unknown): RequestInit => ({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
    mode: "cors",
  });

  if (options.saveConfiguration) {
    options.onStage?.("saving");
    let saved: { success: boolean };
    try {
      saved = await transport.request<{ success: boolean }>(
        `/api/save-config/${options.experimentId}`,
        requestOptions({
          config: { generatedCode: options.generatedCode },
          isDevMode: options.isDevMode ?? false,
        }),
      );
    } catch (error) {
      mapRequestError(error, "saving");
    }
    if (!saved.success) {
      throw new ArtifactBuildError(
        "Failed to save configuration",
        "saving",
        "rejected",
      );
    }
  }

  options.onStage?.("building");
  let result: ExperimentArtifactResult;
  try {
    result = await transport.request<ExperimentArtifactResult>(
      `/api/run-experiment/${options.experimentId}`,
      requestOptions({
        generatedCode: options.generatedCode,
        canvasStyles: options.canvasStyles,
      }),
    );
  } catch (error) {
    mapRequestError(error, "building");
  }
  if (!result.success) {
    throw new ArtifactBuildError(
      "Failed to build experiment artifact",
      "building",
      "rejected",
    );
  }
  return result;
}
