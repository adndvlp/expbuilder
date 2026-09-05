import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, vi } from "vitest";

const hoistedMocks = vi.hoisted(() => ({
  startBackendSetup: vi.fn(),
  writeBackendSetupInput: vi.fn(),
  killBackendSetup: vi.fn(),
  writeBackendEnv: vi.fn(),
  writeFirebaseConfig: vi.fn(),
  writeOauthConfig: vi.fn(),
  readFirebaseConfig: vi.fn(),
  readOauthConfig: vi.fn(),
  backendSetupApi: vi.fn(),
  openExternal: vi.fn(),
}));

export const mocks = hoistedMocks;

let billingChecks = 0;

vi.mock("../../../lib/openExternal", () => ({
  openExternal: mocks.openExternal,
}));

let outputListener: ((data: { id: string; text: string }) => void) | null = null;
let exitListener: ((data: {
  id: string;
  code: number | null;
  error: string | null;
  output: string;
}) => void) | null = null;

export function defaultApi({ action }: { action: string }) {
  switch (action) {
    case "readState":
      return { success: true, state: null };
    case "writeState":
      return { success: true };
    case "listProjects":
      return { success: true, projects: [] };
    case "checkBilling":
      billingChecks += 1;
      return { success: true, enabled: billingChecks > 1 };
    case "listBillingAccounts":
      return { success: true, accounts: [] };
    case "linkBilling":
      return { success: true, enabled: true };
    case "enableAuth":
      return { success: true, emailEnabled: true, googleEnabled: true };
    default:
      return { success: false, error: action };
  }
}

function installElectron() {
  (window as any).electron = {
    startBackendSetup: mocks.startBackendSetup,
    writeBackendSetupInput: mocks.writeBackendSetupInput,
    killBackendSetup: mocks.killBackendSetup,
    writeBackendEnv: mocks.writeBackendEnv,
    writeFirebaseConfig: mocks.writeFirebaseConfig,
    writeOauthConfig: mocks.writeOauthConfig,
    readFirebaseConfig: mocks.readFirebaseConfig,
    readOauthConfig: mocks.readOauthConfig,
    backendSetupApi: mocks.backendSetupApi,
    onBackendSetupOutput: (cb: any) => {
      outputListener = cb;
      return vi.fn();
    },
    onBackendSetupExit: (cb: any) => {
      exitListener = cb;
      return vi.fn();
    },
  };
}

export async function emitExit(
  id: string,
  code: number | null,
  output = "",
  error: string | null = null,
) {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await act(async () => {
    exitListener?.({ id, code, error, output });
  });
}

export function emitOutput(id: string, text: string) {
  act(() => {
    outputListener?.({ id, text });
  });
}

export async function importBackendSetup() {
  vi.resetModules();
  return (await import("../../../pages/Settings/BackendSetup")).default;
}

export function sdkOutput(projectId = "my-proj", appId = "1:123:web:abc") {
  return JSON.stringify({
    project_info: {
      project_number: "123456",
      project_id: projectId,
      storage_bucket: `${projectId}.appspot.com`,
    },
    client: [
      {
        client_info: { mobilesdk_app_id: appId },
        api_key: [{ current_key: "api-key" }],
      },
    ],
  });
}

export async function signIn() {
  const BackendSetup = await importBackendSetup();
  render(<BackendSetup />);
  mocks.startBackendSetup.mockImplementation((args: string[]) =>
    Promise.resolve({ id: `proc-${args.join("-")}` }),
  );
  fireEvent.click(await screen.findByRole("button", { name: "Continue with Google" }));
  await waitFor(() => expect(mocks.startBackendSetup).toHaveBeenCalledWith(["login:ci"]));
  const id = "proc-login:ci";
  emitOutput(
    id,
    "Visit this URL to log in:\n\nhttps://accounts.google.com/x\n\nWaiting for authentication...",
  );
  await screen.findByRole("button", { name: "Open Google sign-in" });
  expect(mocks.openExternal).toHaveBeenCalledWith("https://accounts.google.com/x");
  fireEvent.change(screen.getByPlaceholderText("If Google showed a code, paste it here"), {
    target: { value: "code-123" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit code" }));
  expect(mocks.writeBackendSetupInput).toHaveBeenCalledWith(id, "code-123\n");
  await emitExit(
    id,
    0,
    "Success! Use this token to login on a CI server:\n\n1//token-abc\n\nDone",
  );
  await screen.findByText("Signed in with Google");
  return { BackendSetup };
}

export async function fillProject(projectId = "my-proj", mode: "create" | "use" = "create") {
  if (mode === "use") {
    fireEvent.change(screen.getByDisplayValue("Create a new server"), {
      target: { value: "use" },
    });
    fireEvent.change(screen.getByLabelText("Existing Google project"), {
      target: { value: projectId },
    });
    return;
  }
  fireEvent.change(screen.getByPlaceholderText("Project name (for example my-lab)"), {
    target: { value: projectId },
  });
}

export async function emitProjectResult(
  projectId: string,
  code: number,
  output = "project ok",
  error: string | null = null,
) {
  await waitFor(() =>
    expect(mocks.startBackendSetup).toHaveBeenCalledWith(
      ["projects:create", projectId, "--display-name", projectId],
      "1//token-abc",
    ),
  );
  const id = mocks.startBackendSetup.mock.calls.at(-1)?.[0].join("-");
  await emitExit(`proc-${id}`, code, output, error);
}

export async function emitAppsList(projectId: string, output = "No apps found.") {
  await waitFor(() =>
    expect(mocks.startBackendSetup).toHaveBeenCalledWith(
      ["--project", projectId, "apps:list", "WEB"],
      "1//token-abc",
    ),
  );
  const listId = mocks.startBackendSetup.mock.calls.at(-1)?.[0].join("-");
  await emitExit(`proc-${listId}`, 0, output);
}

export async function emitWebAppSuccess(projectId = "my-proj", appId = "1:123:web:abc") {
  await emitAppsList(projectId);
  await waitFor(() =>
    expect(mocks.startBackendSetup).toHaveBeenCalledWith(
      ["--project", projectId, "apps:create", "web", "ExpBuilder"],
      "1//token-abc",
    ),
  );
  const createId = mocks.startBackendSetup.mock.calls.at(-1)?.[0].join("-");
  await emitExit(`proc-${createId}`, 0, `Created Firebase App ${appId}`);
  await waitFor(() =>
    expect(mocks.startBackendSetup).toHaveBeenCalledWith(
      ["--project", projectId, "apps:sdkconfig", "web", appId],
      "1//token-abc",
    ),
  );
  const sdkId = mocks.startBackendSetup.mock.calls.at(-1)?.[0].join("-");
  await emitExit(`proc-${sdkId}`, 0, sdkOutput(projectId, appId));
  await screen.findByRole("button", { name: "Open billing page" });
}

export async function setUpBackend(projectId = "my-proj", mode: "create" | "use" = "create") {
  await fillProject(projectId, mode);
  fireEvent.click(screen.getByRole("button", { name: "Set up my server" }));
  if (mode === "create") {
    await emitProjectResult(projectId, 0);
  }
  await emitWebAppSuccess(projectId);
}

export function installBackendSetupHooks() {
  beforeEach(() => {
    vi.clearAllMocks();
    billingChecks = 0;
    installElectron();
    mocks.writeBackendSetupInput.mockResolvedValue({ success: true });
    mocks.writeBackendEnv.mockResolvedValue({ success: true });
    mocks.writeFirebaseConfig.mockResolvedValue({ success: true });
    mocks.writeOauthConfig.mockResolvedValue({ success: true });
    mocks.readFirebaseConfig.mockResolvedValue(null);
    mocks.readOauthConfig.mockResolvedValue(null);
    mocks.backendSetupApi.mockImplementation(defaultApi);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    cleanup();
    outputListener = null;
    exitListener = null;
    delete (window as any).electron;
  });
}
