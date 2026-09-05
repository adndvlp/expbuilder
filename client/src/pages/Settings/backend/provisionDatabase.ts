import { commandError } from "../../../lib/backendSetup";
import type { ExitData } from "./useBackendSession";

export async function provisionDatabase(options: {
  projectId: string;
  token: string;
  runCommand: (args: string[]) => Promise<ExitData>;
  api: NonNullable<typeof window.electron>["backendSetupApi"];
  setError: (message: string) => void;
  persist: (partial: {
    firestoreDone?: boolean;
    authDone?: boolean;
    googleAuthNeedsConsole?: boolean;
  }) => Promise<void>;
  setFirestoreDone: (value: boolean) => void;
  setAuthDone: (value: boolean) => void;
  setGoogleAuthNeedsConsole: (value: boolean) => void;
}): Promise<boolean> {
  const data = await options.runCommand([
    "--project",
    options.projectId,
    "firestore:databases:create",
    "(default)",
    "--location",
    "nam5",
  ]);
  const already =
    data.code !== 0 && /already exists|ALREADY_EXISTS/i.test(data.output);
  if (data.code !== 0 && !already) {
    options.setError(
      commandError(data, "Could not create the database. Try again."),
    );
    return false;
  }
  options.setFirestoreDone(true);
  await options.persist({ firestoreDone: true });
  const auth = await options.api({
    action: "enableAuth",
    token: options.token,
    projectId: options.projectId,
  });
  if (!auth.success) {
    options.setError(auth.error || "Could not turn on Email/password sign-in.");
    return false;
  }
  options.setAuthDone(true);
  options.setGoogleAuthNeedsConsole(Boolean(auth.googleNeedsConsole));
  await options.persist({
    authDone: true,
    googleAuthNeedsConsole: Boolean(auth.googleNeedsConsole),
  });
  return true;
}
