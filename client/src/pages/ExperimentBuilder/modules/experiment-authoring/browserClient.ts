import { createExperimentAuthoringClient } from "./client";
import { getApiBaseUrl } from "../../../../lib/apiBaseUrl";

export const experimentAuthoringClient = createExperimentAuthoringClient({
  baseUrl: getApiBaseUrl(),
});
