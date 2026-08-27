import type { CanvasStyles } from "../../../ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";
import type {
  GetLoopFn,
  GetLoopTimelineFn,
  GetTrialFn,
  UploadedFile,
} from "../../../../utils/codegen/types";
import { buildLocalExperimentCode } from "./buildLocalExperimentCode";
import {
  branchingEvaluationRuntimeCode,
  evaluateConditionRuntimeCode,
} from "./branchingRuntimeCode";
import { generateExperimentBaseCode } from "./generateExperimentBaseCode";
import type { SessionNameToken } from "./localCodeTypes";

type CompileLocalExperimentOptions = {
  experimentID: string;
  apiBaseUrl?: string;
  fetchImpl?: typeof fetch;
  uploadedFiles?: UploadedFile[];
  getTrial: GetTrialFn;
  getLoopTimeline: GetLoopTimelineFn;
  getLoop: GetLoopFn;
  canvasStyles?: CanvasStyles;
  baseCodeOverride?: string;
  customCode?: string;
  customPreInitCode?: string;
  localParams?: Record<string, string>;
};

const joinUrl = (baseUrl: string, path: string) =>
  `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;

async function loadJson<T>(
  fetchImpl: typeof fetch,
  url: string,
): Promise<T> {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`GET ${url} failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export async function compileLocalExperiment(
  options: CompileLocalExperimentOptions,
): Promise<string> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiBaseUrl = options.apiBaseUrl ?? "";
  const [extensionData, sessionConfig] = await Promise.all([
    loadJson<{ extensions?: string[] }>(
      fetchImpl,
      joinUrl(apiBaseUrl, `/api/trials-extensions/${options.experimentID}`),
    ),
    loadJson<{ tokens?: SessionNameToken[]; separator?: string }>(
      fetchImpl,
      joinUrl(apiBaseUrl, `/api/session-name-config/${options.experimentID}`),
    ).catch(() => ({ tokens: [], separator: "_" })),
  ]);
  const extensions = extensionData.extensions ?? [];
  const extensionCode = extensions.length
    ? `extensions: [${extensions.map((type) => `{ type: ${type} }`).join(", ")}],`
    : "";
  const baseCode =
    options.baseCodeOverride ??
    (await generateExperimentBaseCode({
      ...options,
      uploadedFiles: options.uploadedFiles ?? [],
      fetchImpl,
    }));

  return buildLocalExperimentCode({
    experimentID: options.experimentID,
    sessionNameTokens: sessionConfig.tokens ?? [],
    sessionNameSeparator: sessionConfig.separator ?? "_",
    evaluateCondition: evaluateConditionRuntimeCode,
    branchingEvaluation: branchingEvaluationRuntimeCode,
    baseCode,
    customCode: options.customCode,
    customPreInitCode: { local: options.customPreInitCode ?? "" },
    extensions: extensionCode,
    localParams: options.localParams ?? {},
    progressBar: options.canvasStyles?.progressBar ?? false,
  });
}
