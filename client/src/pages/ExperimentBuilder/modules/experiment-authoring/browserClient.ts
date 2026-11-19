import { createExperimentAuthoringClient } from "./client";
import { getApiBaseUrl } from "../../../../lib/apiBaseUrl";
import { workspaceClient } from "../experiment-workspace/browserClient";

export const experimentAuthoringClient = createExperimentAuthoringClient({
  baseUrl: getApiBaseUrl(),
  workspace: workspaceClient,
});
