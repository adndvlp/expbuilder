import {
  buildFunctionsEnv,
  buildOauthConfig,
  commandError,
  functionsDeployOnly,
  publishingFingerprint,
  type BackendOAuthState,
} from "../../../lib/backendSetup";
import type { ExitData } from "./useBackendSession";

export async function finishBackendDeploy(options: {
  projectId: string;
  oauth: BackendOAuthState;
  deployed: boolean;
  runCommand: (args: string[]) => Promise<ExitData>;
  persist: (partial: { deployed?: boolean }) => Promise<void>;
  setError: (message: string) => void;
  setDeployed: (value: boolean) => void;
  setSavedPublishing: (value: string) => void;
}): Promise<boolean> {
  const savedEnv = await window.electron!.writeBackendEnv(
    buildFunctionsEnv(options.projectId, options.oauth),
  );
  if (!savedEnv.success) {
    options.setError(
      `Could not save server credentials: ${savedEnv.error || "Unknown error"}`,
    );
    return false;
  }
  const savedOauth = await window.electron!.writeOauthConfig(
    buildOauthConfig(options.oauth),
  );
  if (!savedOauth.success) {
    options.setError(
      `Could not save OAuth credentials: ${savedOauth.error || "Unknown error"}`,
    );
    return false;
  }
  const data = await options.runCommand([
    "--project",
    options.projectId,
    "deploy",
    "--only",
    functionsDeployOnly(options.deployed),
  ]);
  if (data.code !== 0) {
    options.setError(
      commandError(data, "Could not deploy the server. Try again."),
    );
    return false;
  }
  options.setDeployed(true);
  options.setSavedPublishing(publishingFingerprint(options.oauth));
  await options.persist({ deployed: true });
  return true;
}
