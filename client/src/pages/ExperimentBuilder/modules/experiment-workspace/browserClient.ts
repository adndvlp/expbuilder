import { createWorkspaceClient } from "./client";
import { createJsonTransport } from "../experiment-authoring/http";
import { getApiBaseUrl } from "../../../../lib/apiBaseUrl";
export const workspaceClient = createWorkspaceClient(
  createJsonTransport({ baseUrl: getApiBaseUrl() }),
);
