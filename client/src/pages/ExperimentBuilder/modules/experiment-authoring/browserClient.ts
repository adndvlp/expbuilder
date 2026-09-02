import { createExperimentAuthoringClient } from "./client";

export const experimentAuthoringClient = createExperimentAuthoringClient({
  baseUrl: import.meta.env.VITE_API_URL,
});
