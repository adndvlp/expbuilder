import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
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

let billingChecks = 0;

vi.mock("../../lib/openExternal", () => ({
  openExternal: mocks.openExternal,
}));

let outputListener: ((data: { id: string; text: string }) => void) | null = null;
let exitListener: ((data: {
  id: string;
  code: number | null;
  error: string | null;
  output: string;
}) => void) | null = null;

function defaultApi({ action }: { action: string }) {
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

async function emitExit(
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

function emitOutput(id: string, text: string) {
  act(() => {
    outputListener?.({ id, text });
  });
}

async function importBackendSetup() {
  vi.resetModules();
  return (await import("../../pages/Settings/BackendSetup")).default;
}

function sdkOutput(projectId = "my-proj", appId = "1:123:web:abc") {
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

async function signIn() {
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

async function fillProject(projectId = "my-proj", mode: "create" | "use" = "create") {
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

async function emitProjectResult(
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

async function emitAppsList(projectId: string, output = "No apps found.") {
  await waitFor(() =>
    expect(mocks.startBackendSetup).toHaveBeenCalledWith(
      ["--project", projectId, "apps:list", "WEB"],
      "1//token-abc",
    ),
  );
  const listId = mocks.startBackendSetup.mock.calls.at(-1)?.[0].join("-");
  await emitExit(`proc-${listId}`, 0, output);
}

async function emitWebAppSuccess(projectId = "my-proj", appId = "1:123:web:abc") {
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

async function setUpBackend(projectId = "my-proj", mode: "create" | "use" = "create") {
  await fillProject(projectId, mode);
  fireEvent.click(screen.getByRole("button", { name: "Set up my server" }));
  if (mode === "create") {
    await emitProjectResult(projectId, 0);
  }
  await emitWebAppSuccess(projectId);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  cleanup();
  outputListener = null;
  exitListener = null;
  delete (window as any).electron;
});

describe("coverage settings: BackendSetup", () => {
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

  it("shows the non-Electron availability message", async () => {
    delete (window as any).electron;
    const BackendSetup = await importBackendSetup();

    render(<BackendSetup />);

    expect(
      screen.getByText("Server setup is only available in the Electron app."),
    ).toBeInTheDocument();
  });

  it("opens Google sign-in and reports login failures", async () => {
    const BackendSetup = await importBackendSetup();
    render(<BackendSetup />);
    mocks.startBackendSetup.mockImplementation(() =>
      Promise.resolve({ id: "proc-login:ci" }),
    );

    fireEvent.click(await screen.findByRole("button", { name: "Continue with Google" }));
    emitOutput(
      "proc-login:ci",
      "Visit this URL to log in:\n\nhttps://accounts.google.com/x\n\n",
    );
    await screen.findByRole("button", { name: "Open Google sign-in" });
    expect(mocks.openExternal).toHaveBeenCalledWith("https://accounts.google.com/x");
    fireEvent.click(screen.getByRole("button", { name: "Open Google sign-in" }));
    expect(mocks.openExternal).toHaveBeenCalledWith("https://accounts.google.com/x");

    await emitExit("proc-login:ci", 1, "auth rejected");
    await screen.findByText("Sign-in failed. Try again.");

    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    await emitExit("proc-login:ci", 0, "no token here");
    await waitFor(() =>
      expect(screen.getAllByText("Sign-in failed. Try again.").length).toBeGreaterThan(0),
    );
  });

  it("reports login start failures and ignores empty login codes", async () => {
    const BackendSetup = await importBackendSetup();
    render(<BackendSetup />);
    mocks.startBackendSetup
      .mockResolvedValueOnce({ id: "proc-login:ci" })
      .mockRejectedValueOnce(new Error("spawn exploded"))
      .mockRejectedValueOnce("mystery failure");

    fireEvent.click(await screen.findByRole("button", { name: "Continue with Google" }));
    emitOutput(
      "proc-login:ci",
      "Visit this URL to log in:\n\nhttps://accounts.google.com/x\n\n",
    );
    await screen.findByRole("button", { name: "Open Google sign-in" });
    fireEvent.click(screen.getByRole("button", { name: "Submit code" }));
    expect(mocks.writeBackendSetupInput).not.toHaveBeenCalled();
    await emitExit("proc-login:ci", 1, "");
    await screen.findByText("Sign-in failed. Try again.");

    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    await screen.findByText("spawn exploded");

    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    await screen.findByText("Could not start Google sign-in");
  });

  it("creates a backend then completes billing, database and sign-in steps", async () => {
    await signIn();
    await setUpBackend("my-proj");

    fireEvent.click(screen.getByRole("button", { name: "Open billing page" }));
    expect(mocks.openExternal).toHaveBeenCalledWith(
      "https://console.firebase.google.com/project/my-proj/settings/usage",
    );
    fireEvent.click(screen.getByRole("button", { name: "Continue after billing" }));
    await waitFor(() =>
      expect(mocks.startBackendSetup).toHaveBeenCalledWith(
        [
          "--project",
          "my-proj",
          "firestore:databases:create",
          "(default)",
          "--location",
          "nam5",
        ],
        "1//token-abc",
      ),
    );
    const firestoreId = mocks.startBackendSetup.mock.calls.at(-1)?.[0].join("-");
    await emitExit(`proc-${firestoreId}`, 0, "firestore ok");
    await waitFor(() =>
      expect(mocks.backendSetupApi).toHaveBeenCalledWith(
        expect.objectContaining({ action: "enableAuth", projectId: "my-proj" }),
      ),
    );
    expect(await screen.findByRole("button", { name: "Finish setup" })).toBeEnabled();
  });

  it("reports project step failures and start exceptions", async () => {
    await signIn();
    await fillProject("my-proj");
    fireEvent.click(screen.getByRole("button", { name: "Set up my server" }));
    await emitProjectResult("my-proj", 1, "", "project rejected");
    await screen.findByText("project rejected");

    mocks.startBackendSetup.mockResolvedValueOnce({ id: "p-no-err" });
    fireEvent.click(screen.getByRole("button", { name: "Set up my server" }));
    await emitExit("p-no-err", 1, "");
    await screen.findByText("Could not set up the project. Try again.");

    mocks.startBackendSetup.mockRejectedValue(new Error("boom"));
    fireEvent.click(screen.getByRole("button", { name: "Set up my server" }));
    await screen.findByText("boom");

    mocks.startBackendSetup.mockRejectedValue("weird");
    fireEvent.click(screen.getByRole("button", { name: "Set up my server" }));
    await screen.findByText("Could not finish server setup.");
  });

  it("uses an existing project without creating it", async () => {
    mocks.backendSetupApi.mockImplementation(async (payload: { action: string }) => {
      if (payload.action === "listProjects") {
        return {
          success: true,
          projects: [{ projectId: "existing-proj", displayName: "Existing" }],
        };
      }
      return defaultApi(payload);
    });
    await signIn();
    await fillProject("existing-proj", "use");
    fireEvent.click(screen.getByRole("button", { name: "Set up my server" }));
    await emitWebAppSuccess("existing-proj");

    expect(mocks.startBackendSetup).not.toHaveBeenCalledWith(
      expect.arrayContaining(["projects:create"]),
      expect.anything(),
    );
    expect(mocks.startBackendSetup).toHaveBeenCalledWith(
      ["--project", "existing-proj", "apps:create", "web", "ExpBuilder"],
      "1//token-abc",
    );
  });

  it("reports Firestore creation failures and exceptions", async () => {
    await signIn();
    await setUpBackend("my-proj");
    mocks.startBackendSetup.mockResolvedValueOnce({ id: "f1" });
    fireEvent.click(screen.getByRole("button", { name: "Continue after billing" }));
    await waitFor(() =>
      expect(mocks.startBackendSetup).toHaveBeenCalledWith(
        expect.arrayContaining(["firestore:databases:create"]),
        "1//token-abc",
      ),
    );
    await emitExit("f1", 1, "", "fs denied");
    await screen.findByText("fs denied");

    const retryDatabase = () =>
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    mocks.startBackendSetup.mockResolvedValueOnce({ id: "f2" });
    retryDatabase();
    await emitExit("f2", 1, "");
    await screen.findByText("Could not create the database. Try again.");

    mocks.startBackendSetup.mockRejectedValueOnce(new Error("fs exploded"));
    retryDatabase();
    await screen.findByText("fs exploded");

    mocks.startBackendSetup.mockRejectedValueOnce("fs weird");
    retryDatabase();
    await screen.findByText("Could not create the database.");
  });

  it("creates the web app and saves the firebase config", async () => {
    await signIn();
    await setUpBackend("my-proj");

    expect(mocks.writeFirebaseConfig).toHaveBeenCalledWith({
      apiKey: "api-key",
      authDomain: "my-proj.firebaseapp.com",
      projectId: "my-proj",
      storageBucket: "my-proj.appspot.com",
      messagingSenderId: "123456",
      appId: "1:123:web:abc",
    });
    expect(
      screen.queryByRole("button", { name: "Set up my server" }),
    ).not.toBeInTheDocument();
  });

  it("reports web app creation failures", async () => {
    await signIn();
    await fillProject("my-proj");
    fireEvent.click(screen.getByRole("button", { name: "Set up my server" }));
    await emitProjectResult("my-proj", 0);
    await emitAppsList("my-proj");
    await waitFor(() =>
      expect(mocks.startBackendSetup).toHaveBeenCalledWith(
        ["--project", "my-proj", "apps:create", "web", "ExpBuilder"],
        "1//token-abc",
      ),
    );
    const firstCreateId = mocks.startBackendSetup.mock.calls.at(-1)?.[0].join("-");
    await emitExit(`proc-${firstCreateId}`, 1, "", "create rejected");
    await screen.findByText("create rejected");

    const retry = () =>
      fireEvent.click(screen.getByRole("button", { name: "Set up my server" }));

    async function emitCreate(
      code: number,
      output: string,
      error: string | null = null,
    ) {
      await emitAppsList("my-proj");
      await waitFor(() =>
        expect(mocks.startBackendSetup).toHaveBeenCalledWith(
          ["--project", "my-proj", "apps:create", "web", "ExpBuilder"],
          "1//token-abc",
        ),
      );
      const createId = mocks.startBackendSetup.mock.calls.at(-1)?.[0].join("-");
      await emitExit(`proc-${createId}`, code, output, error);
      return createId;
    }

    async function emitSdk(appId: string, code: number, output: string, error: string | null = null) {
      await waitFor(() =>
        expect(mocks.startBackendSetup).toHaveBeenCalledWith(
          ["--project", "my-proj", "apps:sdkconfig", "web", appId],
          "1//token-abc",
        ),
      );
      const sdkId = mocks.startBackendSetup.mock.calls.at(-1)?.[0].join("-");
      await emitExit(`proc-${sdkId}`, code, output, error);
    }

    retry();
    await emitCreate(1, "");
    await screen.findByText("Could not create the web app. Try again.");

    retry();
    await emitCreate(0, "no app id");
    await screen.findByText("Could not read the new app id.");

    retry();
    await emitCreate(0, "Created Firebase App 1:1:web:1");
    await emitSdk("1:1:web:1", 1, "", "sdk rejected");
    await screen.findByText("sdk rejected");

    retry();
    await emitCreate(0, "Created Firebase App 1:1b:web:1b");
    await emitSdk("1:1b:web:1b", 1, "");
    await screen.findByText("Could not read the app config. Try again.");

    retry();
    await emitCreate(0, "Created Firebase App 1:2:web:2");
    await emitSdk("1:2:web:2", 0, "garbage output");
    await screen.findByText("Could not parse the app config.");

    mocks.writeFirebaseConfig
      .mockResolvedValueOnce({ success: false, error: "disk full" })
      .mockResolvedValueOnce({ success: false });
    retry();
    await emitCreate(0, "Created Firebase App 1:3:web:3");
    await emitSdk("1:3:web:3", 0, sdkOutput("proj", "app"));
    await screen.findByText("Could not save the Firebase config: disk full");

    retry();
    await emitCreate(0, "Created Firebase App 1:4:web:4");
    await emitSdk("1:4:web:4", 0, sdkOutput("proj", "app"));
    await screen.findByText("Could not save the Firebase config: Unknown error");

    mocks.startBackendSetup.mockImplementation((args: string[]) => {
      if (args.includes("apps:sdkconfig")) {
        return Promise.reject(new Error("sdk exploded"));
      }
      return Promise.resolve({ id: `proc-${args.join("-")}` });
    });
    retry();
    await emitCreate(0, "Created Firebase App 1:5:web:5");
    await screen.findByText("sdk exploded");

    mocks.startBackendSetup.mockRejectedValue("weird failure");
    retry();
    await screen.findByText("Could not finish server setup.");
  });

  it("saves backend credentials from enabled providers and deploys", async () => {
    await signIn();
    await setUpBackend("my-proj");
    fireEvent.click(screen.getByRole("button", { name: "Continue after billing" }));
    await waitFor(() =>
      expect(mocks.startBackendSetup).toHaveBeenCalledWith(
        expect.arrayContaining(["firestore:databases:create"]),
        "1//token-abc",
      ),
    );
    const firestoreId = mocks.startBackendSetup.mock.calls.at(-1)?.[0].join("-");
    await emitExit(`proc-${firestoreId}`, 0, "");
    await screen.findByRole("button", { name: "Finish setup" });

    fireEvent.click(
      screen.getByText(/Add publishing later/),
    );
    const githubCheckbox = screen.getAllByRole("checkbox")[0];
    fireEvent.click(githubCheckbox);
    fireEvent.change(screen.getByPlaceholderText("GitHub Client ID"), {
      target: { value: "gh-id" },
    });
    fireEvent.change(screen.getByPlaceholderText("GitHub Client Secret"), {
      target: { value: "gh-secret" },
    });

    const osfLink = screen.getAllByText("open console")[0];
    fireEvent.click(osfLink);
    expect(mocks.openExternal).toHaveBeenCalledWith(
      "https://github.com/settings/developers",
    );

    fireEvent.click(screen.getByRole("button", { name: "Finish setup" }));
    await waitFor(() =>
      expect(mocks.writeBackendEnv).toHaveBeenCalledWith({
        OSF_OAUTH_CALLBACK_URL:
          "https://us-central1-my-proj.cloudfunctions.net/osfOAuthCallback",
        OSF_POST_AUTH_REDIRECT_URL: "http://localhost:8888/callback",
        GITHUB_CLIENT_ID: "gh-id",
        GITHUB_CLIENT_SECRET: "gh-secret",
      }),
    );
    await waitFor(() =>
      expect(mocks.writeOauthConfig).toHaveBeenCalledWith({
        githubClientId: "gh-id",
      }),
    );

    await waitFor(() =>
      expect(mocks.startBackendSetup).toHaveBeenCalledWith(
        ["--project", "my-proj", "deploy", "--only", "firestore,functions"],
        "1//token-abc",
      ),
    );
    const deployId = mocks.startBackendSetup.mock.calls.at(-1)?.[0].join("-");
    await emitExit(`proc-${deployId}`, 0, "deploy ok");
    await screen.findByText("Connected to my-proj.");

    fireEvent.click(screen.getByText("Technical details"));
    expect(screen.getByText(/\$ firebase --project my-proj deploy/)).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Save publishing credentials" }),
    ).toBeDisabled();
    expect(
      screen.getByText("Change a publishing account to save again."),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("GitHub Client Secret"), {
      target: { value: "gh-secret-2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save publishing credentials" }));
    await waitFor(() =>
      expect(mocks.startBackendSetup).toHaveBeenCalledWith(
        ["--project", "my-proj", "deploy", "--only", "functions"],
        "1//token-abc",
      ),
    );
  });

  it("reports credential save and deploy failures", async () => {
    await signIn();
    await setUpBackend("my-proj");
    fireEvent.click(screen.getByRole("button", { name: "Continue after billing" }));
    await waitFor(() =>
      expect(mocks.startBackendSetup).toHaveBeenCalledWith(
        expect.arrayContaining(["firestore:databases:create"]),
        "1//token-abc",
      ),
    );
    const firestoreId = mocks.startBackendSetup.mock.calls.at(-1)?.[0].join("-");
    await emitExit(`proc-${firestoreId}`, 0, "");
    await screen.findByRole("button", { name: "Finish setup" });

    const save = () =>
      fireEvent.click(screen.getByRole("button", { name: "Finish setup" }));

    mocks.writeBackendEnv
      .mockResolvedValueOnce({ success: false, error: "env denied" })
      .mockResolvedValueOnce({ success: false })
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: true })
      .mockRejectedValueOnce(new Error("env exploded"))
      .mockRejectedValueOnce("env weird");
    mocks.writeOauthConfig
      .mockResolvedValueOnce({ success: false, error: "oauth denied" })
      .mockResolvedValueOnce({ success: false });

    save();
    await screen.findByText("Could not save server credentials: env denied");
    save();
    await screen.findByText("Could not save server credentials: Unknown error");
    save();
    await screen.findByText("Could not save OAuth credentials: oauth denied");
    save();
    await screen.findByText("Could not save OAuth credentials: Unknown error");
    save();
    await screen.findByText("env exploded");
    save();
    await screen.findByText("Could not finish setup.");
  });

  it("reports deploy failures and exceptions", async () => {
    await signIn();
    await setUpBackend("my-proj");
    fireEvent.click(screen.getByRole("button", { name: "Continue after billing" }));
    await waitFor(() =>
      expect(mocks.startBackendSetup).toHaveBeenCalledWith(
        expect.arrayContaining(["firestore:databases:create"]),
        "1//token-abc",
      ),
    );
    const firestoreId = mocks.startBackendSetup.mock.calls.at(-1)?.[0].join("-");
    await emitExit(`proc-${firestoreId}`, 0, "");
    await screen.findByRole("button", { name: "Finish setup" });

    const clickDeploy = () =>
      fireEvent.click(screen.getByRole("button", { name: "Finish setup" }));

    mocks.writeBackendEnv.mockResolvedValue({ success: true });
    mocks.writeOauthConfig.mockResolvedValue({ success: true });

    mocks.startBackendSetup.mockResolvedValueOnce({ id: "d1" });
    clickDeploy();
    await waitFor(() =>
      expect(mocks.startBackendSetup).toHaveBeenCalledWith(
        ["--project", "my-proj", "deploy", "--only", "firestore,functions"],
        "1//token-abc",
      ),
    );
    await emitExit("d1", 1, "", "deploy denied");
    await screen.findByText("deploy denied");

    mocks.startBackendSetup.mockResolvedValueOnce({ id: "d1b" });
    clickDeploy();
    await waitFor(() =>
      expect(
        mocks.startBackendSetup.mock.calls.filter((call) =>
          call[0]?.includes("deploy"),
        ).length,
      ).toBe(2),
    );
    await emitExit("d1b", 1, "");
    await screen.findByText("Could not deploy the server. Try again.");

    mocks.startBackendSetup.mockRejectedValueOnce(new Error("deploy exploded"));
    clickDeploy();
    await screen.findByText("deploy exploded");

    mocks.startBackendSetup.mockRejectedValueOnce("deploy weird");
    clickDeploy();
    await screen.findByText("Could not finish setup.");

    await emitExit("unknown-process-id", 0, "");
    emitOutput("unknown-process-id", "plain log output without a login url");
  });

  it("resumes a connected server and leftover publishing", async () => {
    mocks.readFirebaseConfig.mockResolvedValue({
      apiKey: "k",
      authDomain: "lab.firebaseapp.com",
      projectId: "lab",
      storageBucket: "lab.appspot.com",
      messagingSenderId: "1",
      appId: "1:1:web:1",
    });
    mocks.readOauthConfig.mockResolvedValue({ githubClientId: "gh" });
    mocks.backendSetupApi.mockImplementation(async (payload: { action: string }) => {
      if (payload.action === "readState") {
        return {
          success: true,
          state: {
            projectId: "lab",
            token: "1//token-abc",
            configSaved: true,
            billingDone: true,
            firestoreDone: true,
            authDone: true,
            deployed: true,
          },
        };
      }
      return defaultApi(payload);
    });
    const BackendSetup = await importBackendSetup();
    render(<BackendSetup />);
    await screen.findByText("Connected to lab.");
    expect(screen.getByText(/GitHub ready. Still to set up/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save publishing credentials" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Continue with Google" }),
    ).not.toBeInTheDocument();
  });
});
