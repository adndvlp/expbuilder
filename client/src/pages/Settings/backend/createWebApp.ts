import {
  buildFirebaseConfig,
  commandError,
  parseCreatedAppId,
  parseListedWebAppId,
  parseSdkConfig,
} from "../../../lib/backendSetup";
import type { ExitData } from "./useBackendSession";

export async function createWebApp(options: {
  projectId: string;
  runCommand: (args: string[]) => Promise<ExitData>;
  setError: (message: string) => void;
}): Promise<boolean> {
  const { projectId, runCommand, setError } = options;
  const listed = await runCommand(["--project", projectId, "apps:list", "WEB"]);
  let appId = listed.code === 0 ? parseListedWebAppId(listed.output) : null;
  if (!appId) {
    const created = await runCommand([
      "--project",
      projectId,
      "apps:create",
      "web",
      "ExpBuilder",
    ]);
    if (created.code !== 0) {
      setError(commandError(created, "Could not create the web app. Try again."));
      return false;
    }
    appId = parseCreatedAppId(created.output);
  }
  if (!appId) {
    setError("Could not read the new app id.");
    return false;
  }
  const sdkResult = await runCommand([
    "--project",
    projectId,
    "apps:sdkconfig",
    "web",
    appId,
  ]);
  if (sdkResult.code !== 0) {
    setError(commandError(sdkResult, "Could not read the app config. Try again."));
    return false;
  }
  const sdk = parseSdkConfig(sdkResult.output);
  const firebaseConfig = sdk ? buildFirebaseConfig(sdk) : null;
  if (!firebaseConfig) {
    setError("Could not parse the app config.");
    return false;
  }
  const saved = await window.electron!.writeFirebaseConfig(firebaseConfig);
  if (!saved.success) {
    setError(
      `Could not save the Firebase config: ${saved.error || "Unknown error"}`,
    );
    return false;
  }
  return true;
}
