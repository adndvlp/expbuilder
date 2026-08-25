import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  startBackendSetup: vi.fn(),
  writeBackendSetupInput: vi.fn(),
  killBackendSetup: vi.fn(),
  writeBackendEnv: vi.fn(),
  writeFirebaseConfig: vi.fn(),
  writeOauthConfig: vi.fn(),
  openExternal: vi.fn(),
}));

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

function installElectron() {
  (window as any).electron = {
    startBackendSetup: mocks.startBackendSetup,
    writeBackendSetupInput: mocks.writeBackendSetupInput,
    killBackendSetup: mocks.killBackendSetup,
    writeBackendEnv: mocks.writeBackendEnv,
    writeFirebaseConfig: mocks.writeFirebaseConfig,
    writeOauthConfig: mocks.writeOauthConfig,
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

async function signIn() {
  const BackendSetup = await importBackendSetup();
  render(<BackendSetup />);
  mocks.startBackendSetup.mockImplementation((args: string[]) =>
    Promise.resolve({ id: `proc-${args.join("-")}` }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Sign in with Firebase" }));
  await waitFor(() => expect(mocks.startBackendSetup).toHaveBeenCalledWith(["login:ci"]));
  const id = "proc-login:ci";
  emitOutput(
    id,
    "Visit this URL to log in:\n\nhttps://accounts.google.com/x\n\nWaiting for authentication...",
  );
  await screen.findByRole("button", { name: "Open login page" });
  fireEvent.change(screen.getByPlaceholderText("Paste the code from the browser"), {
    target: { value: "code-123" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit code" }));
  expect(mocks.writeBackendSetupInput).toHaveBeenCalledWith(id, "code-123\n");
  await emitExit(
    id,
    0,
    "Success! Use this token to login on a CI server:\n\n1//token-abc\n\nDone",
  );
  await screen.findByRole("button", { name: "Signed in" });
  return { BackendSetup };
}

async function setProject(projectId = "my-proj", mode: "create" | "use" = "create") {
  if (mode === "use") {
    fireEvent.change(screen.getByDisplayValue("Create new project"), {
      target: { value: "use" },
    });
  }
  fireEvent.change(screen.getByPlaceholderText("Firebase project ID"), {
    target: { value: projectId },
  });
  fireEvent.click(screen.getByRole("button", { name: "Set project" }));
  await waitFor(() =>
    expect(mocks.startBackendSetup).toHaveBeenCalledWith(
      mode === "create"
        ? ["--project", projectId, "projects:create"]
        : ["--project", projectId],
      "1//token-abc",
    ),
  );
  const id = mocks.startBackendSetup.mock.calls.at(-1)?.[0].join("-");
  await emitExit(`proc-${id}`, 0, "project ok");
  await screen.findByRole("button", { name: "Project ready" });
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
    installElectron();
    mocks.writeBackendSetupInput.mockResolvedValue({ success: true });
    mocks.writeBackendEnv.mockResolvedValue({ success: true });
    mocks.writeFirebaseConfig.mockResolvedValue({ success: true });
    mocks.writeOauthConfig.mockResolvedValue({ success: true });
  });

  it("shows the non-Electron availability message", async () => {
    delete (window as any).electron;
    const BackendSetup = await importBackendSetup();

    render(<BackendSetup />);

    expect(
      screen.getByText("Backend setup is only available in the Electron app."),
    ).toBeInTheDocument();
  });

  it("opens the login page and reports login failures", async () => {
    const BackendSetup = await importBackendSetup();
    render(<BackendSetup />);
    mocks.startBackendSetup.mockImplementation(() =>
      Promise.resolve({ id: "proc-login:ci" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign in with Firebase" }));
    emitOutput(
      "proc-login:ci",
      "Visit this URL to log in:\n\nhttps://accounts.google.com/x\n\n",
    );
    await screen.findByRole("button", { name: "Open login page" });
    fireEvent.click(screen.getByRole("button", { name: "Open login page" }));
    expect(mocks.openExternal).toHaveBeenCalledWith("https://accounts.google.com/x");

    await emitExit("proc-login:ci", 1, "auth rejected");
    await screen.findByText("Login failed. Check the log below and try again.");

    fireEvent.click(screen.getByRole("button", { name: "Sign in with Firebase" }));
    await emitExit("proc-login:ci", 0, "no token here");
    await waitFor(() =>
      expect(
        screen.getAllByText("Login failed. Check the log below and try again.").length,
      ).toBeGreaterThan(0),
    );
  });

  it("reports login start failures and ignores empty login codes", async () => {
    const BackendSetup = await importBackendSetup();
    render(<BackendSetup />);
    mocks.startBackendSetup
      .mockResolvedValueOnce({ id: "proc-login:ci" })
      .mockRejectedValueOnce(new Error("spawn exploded"))
      .mockRejectedValueOnce("mystery failure");

    fireEvent.click(screen.getByRole("button", { name: "Sign in with Firebase" }));
    emitOutput(
      "proc-login:ci",
      "Visit this URL to log in:\n\nhttps://accounts.google.com/x\n\n",
    );
    await screen.findByRole("button", { name: "Open login page" });
    fireEvent.click(screen.getByRole("button", { name: "Submit code" }));
    expect(mocks.writeBackendSetupInput).not.toHaveBeenCalled();
    await emitExit("proc-login:ci", 1, "");
    await screen.findByText("Login failed. Check the log below and try again.");

    fireEvent.click(screen.getByRole("button", { name: "Sign in with Firebase" }));
    await screen.findByText("spawn exploded");

    fireEvent.click(screen.getByRole("button", { name: "Sign in with Firebase" }));
    await screen.findByText("Failed to start the login flow");
  });

  it("creates and uses projects, then completes Blaze, Firestore and Auth steps", async () => {
    const { BackendSetup } = await signIn();
    await setProject("my-proj");

    fireEvent.click(screen.getByRole("button", { name: "Open Blaze billing page" }));
    expect(mocks.openExternal).toHaveBeenCalledWith(
      "https://console.firebase.google.com/project/my-proj/settings/usage",
    );
    fireEvent.click(screen.getByRole("button", { name: "I upgraded to Blaze" }));
    await screen.findByRole("button", { name: "Blaze plan confirmed" });

    fireEvent.click(
      screen.getByRole("button", { name: "Create Firestore database" }),
    );
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
    await screen.findByRole("button", { name: "Firestore ready" });

    fireEvent.click(screen.getByRole("button", { name: "Open Auth providers page" }));
    expect(mocks.openExternal).toHaveBeenCalledWith(
      "https://console.firebase.google.com/project/my-proj/authentication/providers",
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "I enabled Email/Password and Google",
      }),
    );
    await screen.findByRole("button", { name: "Sign-in providers confirmed" });
  });

  it("reports project step failures and start exceptions", async () => {
    await signIn();
    fireEvent.change(screen.getByPlaceholderText("Firebase project ID"), {
      target: { value: "my-proj" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Set project" }));
    const id = mocks.startBackendSetup.mock.calls.at(-1)?.[0].join("-");
    await emitExit(`proc-${id}`, 1, "", "project rejected");
    await screen.findByText("project rejected");

    mocks.startBackendSetup.mockResolvedValueOnce({ id: "p-no-err" });
    fireEvent.click(screen.getByRole("button", { name: "Set project" }));
    await emitExit("p-no-err", 1, "");
    await screen.findByText("Project step failed. Check the log below.");

    mocks.startBackendSetup.mockRejectedValue(new Error("boom"));
    fireEvent.click(screen.getByRole("button", { name: "Set project" }));
    await screen.findByText("boom");

    mocks.startBackendSetup.mockRejectedValue("weird");
    fireEvent.click(screen.getByRole("button", { name: "Set project" }));
    await screen.findByText("Failed to run the project step");
  });

  it("uses an existing project without creating it", async () => {
    await signIn();
    await setProject("existing-proj", "use");

    expect(mocks.startBackendSetup).toHaveBeenCalledWith(
      ["--project", "existing-proj"],
      "1//token-abc",
    );
  });

  it("reports Firestore creation failures and exceptions", async () => {
    const { BackendSetup } = await signIn();
    await setProject("my-proj");
    fireEvent.click(screen.getByRole("button", { name: "I upgraded to Blaze" }));
    await screen.findByRole("button", { name: "Blaze plan confirmed" });

    const clickFirestore = () =>
      fireEvent.click(
        screen.getByRole("button", { name: "Create Firestore database" }),
      );

    mocks.startBackendSetup.mockResolvedValueOnce({ id: "f1" });
    clickFirestore();
    await emitExit("f1", 1, "", "fs denied");
    await screen.findByText("fs denied");

    mocks.startBackendSetup.mockResolvedValueOnce({ id: "f2" });
    clickFirestore();
    await emitExit("f2", 1, "");
    await screen.findByText("Firestore creation failed. Check the log below.");

    mocks.startBackendSetup.mockRejectedValueOnce(new Error("fs exploded"));
    clickFirestore();
    await screen.findByText("fs exploded");

    mocks.startBackendSetup.mockRejectedValueOnce("fs weird");
    clickFirestore();
    await screen.findByText("Failed to create Firestore");
  });

  it("creates the web app, saves the firebase config and handles failures", async () => {
    const { BackendSetup } = await signIn();
    await setProject("my-proj");

    fireEvent.change(screen.getByPlaceholderText("Web app display name"), {
      target: { value: "My Lab App" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create web app" }));
    await waitFor(() =>
      expect(mocks.startBackendSetup).toHaveBeenCalledWith(
        ["--project", "my-proj", "apps:create", "web", "My Lab App"],
        "1//token-abc",
      ),
    );
    const createId = mocks.startBackendSetup.mock.calls.at(-1)?.[0].join("-");
    await emitExit(`proc-${createId}`, 0, "Created Firebase App 1:123:web:abc");
    await waitFor(() =>
      expect(mocks.startBackendSetup).toHaveBeenCalledWith(
        ["--project", "my-proj", "apps:sdkconfig", "web", "1:123:web:abc"],
        "1//token-abc",
      ),
    );
    const sdkId = mocks.startBackendSetup.mock.calls.at(-1)?.[0].join("-");
    const sdk = {
      project_info: {
        project_number: "123456",
        project_id: "my-proj",
        storage_bucket: "my-proj.appspot.com",
      },
      client: [
        {
          client_info: { mobilesdk_app_id: "1:123:web:abc" },
          api_key: [{ current_key: "api-key" }],
        },
      ],
    };
    await emitExit(`proc-${sdkId}`, 0, JSON.stringify(sdk));
    await waitFor(() =>
      expect(mocks.writeFirebaseConfig).toHaveBeenCalledWith({
        apiKey: "api-key",
        authDomain: "my-proj.firebaseapp.com",
        projectId: "my-proj",
        storageBucket: "my-proj.appspot.com",
        messagingSenderId: "123456",
        appId: "1:123:web:abc",
      }),
    );
    expect(screen.queryByRole("button", { name: "Create web app" })).not.toBeInTheDocument();
  });

  it("reports web app creation failures", async () => {
    const { BackendSetup } = await signIn();
    await setProject("my-proj");
    const clickCreate = () =>
      fireEvent.click(screen.getByRole("button", { name: "Create web app" }));

    mocks.startBackendSetup.mockResolvedValueOnce({ id: "p1" });
    clickCreate();
    await emitExit("p1", 1, "", "create rejected");
    await screen.findByText("create rejected");

    mocks.startBackendSetup.mockResolvedValueOnce({ id: "p1b" });
    clickCreate();
    await emitExit("p1b", 1, "");
    await screen.findByText("Web app creation failed. Check the log below.");

    mocks.startBackendSetup.mockResolvedValueOnce({ id: "p2" });
    clickCreate();
    await emitExit("p2", 0, "no app id");
    await screen.findByText("Could not read the created app ID from the output.");

    mocks.startBackendSetup
      .mockResolvedValueOnce({ id: "p3" })
      .mockResolvedValueOnce({ id: "p4" });
    clickCreate();
    await emitExit("p3", 0, "Created Firebase App 1:1:web:1");
    await emitExit("p4", 1, "", "sdk rejected");
    await screen.findByText("sdk rejected");

    mocks.startBackendSetup
      .mockResolvedValueOnce({ id: "p4b1" })
      .mockResolvedValueOnce({ id: "p4b2" });
    clickCreate();
    await emitExit("p4b1", 0, "Created Firebase App 1:1b:web:1b");
    await emitExit("p4b2", 1, "");
    await screen.findByText(
      "Reading the Firebase SDK config failed. Check the log below.",
    );

    mocks.startBackendSetup
      .mockResolvedValueOnce({ id: "p5" })
      .mockResolvedValueOnce({ id: "p6" });
    clickCreate();
    await emitExit("p5", 0, "Created Firebase App 1:2:web:2");
    await emitExit("p6", 0, "garbage output");
    await screen.findByText("Could not parse the Firebase SDK config from the output.");

    mocks.startBackendSetup
      .mockResolvedValueOnce({ id: "p7" })
      .mockResolvedValueOnce({ id: "p8" });
    mocks.writeFirebaseConfig
      .mockResolvedValueOnce({ success: false, error: "disk full" })
      .mockResolvedValueOnce({ success: false });
    clickCreate();
    await emitExit("p7", 0, "Created Firebase App 1:3:web:3");
    await emitExit(
      "p8",
      0,
      JSON.stringify({
        project_info: {
          project_number: "1",
          project_id: "proj",
          storage_bucket: "b",
        },
        client: [
          {
            client_info: { mobilesdk_app_id: "app" },
            api_key: [{ current_key: "k" }],
          },
        ],
      }),
    );
    await screen.findByText("Saving the Firebase config failed: disk full");

    mocks.startBackendSetup
      .mockResolvedValueOnce({ id: "p9" })
      .mockResolvedValueOnce({ id: "p10" });
    clickCreate();
    await emitExit("p9", 0, "Created Firebase App 1:4:web:4");
    await emitExit(
      "p10",
      0,
      JSON.stringify({
        project_info: {
          project_number: "1",
          project_id: "proj",
          storage_bucket: "b",
        },
        client: [
          {
            client_info: { mobilesdk_app_id: "app" },
            api_key: [{ current_key: "k" }],
          },
        ],
      }),
    );
    await screen.findByText("Saving the Firebase config failed: Unknown error");

    mocks.startBackendSetup
      .mockResolvedValueOnce({ id: "p11" })
      .mockRejectedValueOnce(new Error("sdk exploded"));
    clickCreate();
    await emitExit("p11", 0, "Created Firebase App 1:5:web:5");
    await screen.findByText("sdk exploded");

    mocks.startBackendSetup.mockRejectedValue("weird failure");
    clickCreate();
    await screen.findByText("Failed to create the web app");

    fireEvent.change(screen.getByPlaceholderText("Web app display name"), {
      target: { value: "   " },
    });
    mocks.startBackendSetup.mockResolvedValueOnce({ id: "p-default" });
    clickCreate();
    await waitFor(() =>
      expect(mocks.startBackendSetup).toHaveBeenCalledWith(
        ["--project", "my-proj", "apps:create", "web", "ExpBuilder"],
        "1//token-abc",
      ),
    );
    await emitExit("p-default", 1, "", "default name rejected");
    await screen.findByText("default name rejected");
  });

  it("saves backend credentials from enabled providers and deploys", async () => {
    const { BackendSetup } = await signIn();
    await setProject("my-proj");
    fireEvent.click(screen.getByRole("button", { name: "I upgraded to Blaze" }));
    await screen.findByRole("button", { name: "Blaze plan confirmed" });
    fireEvent.click(screen.getByRole("button", { name: "Create Firestore database" }));
    const firestoreId = mocks.startBackendSetup.mock.calls.at(-1)?.[0].join("-");
    await emitExit(`proc-${firestoreId}`, 0, "");
    await screen.findByRole("button", { name: "Firestore ready" });
    fireEvent.click(
      screen.getByRole("button", { name: "I enabled Email/Password and Google" }),
    );
    await screen.findByRole("button", { name: "Sign-in providers confirmed" });

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

    fireEvent.click(screen.getByRole("button", { name: "Save backend credentials" }));
    await waitFor(() =>
      expect(mocks.writeBackendEnv).toHaveBeenCalledWith({
        FIREBASE_PROJECT_ID: "my-proj",
        FIREBASE_APP_BASE_URL: "https://my-proj.firebaseapp.com",
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
    await screen.findByRole("button", { name: "Credentials saved" });

    fireEvent.click(screen.getByRole("button", { name: "Deploy backend" }));
    await waitFor(() =>
      expect(mocks.startBackendSetup).toHaveBeenCalledWith(
        ["--project", "my-proj", "deploy", "--only", "firestore,functions"],
        "1//token-abc",
      ),
    );
    const deployId = mocks.startBackendSetup.mock.calls.at(-1)?.[0].join("-");
    await emitExit(`proc-${deployId}`, 0, "deploy ok");
    await screen.findByRole("button", { name: "Backend deployed" });

    expect(screen.getByText(/\$ firebase --project my-proj deploy/)).toBeInTheDocument();
  });

  it("reports credential save and deploy failures", async () => {
    const { BackendSetup } = await signIn();
    await setProject("my-proj");
    fireEvent.click(screen.getByRole("button", { name: "I upgraded to Blaze" }));
    await screen.findByRole("button", { name: "Blaze plan confirmed" });
    fireEvent.click(screen.getByRole("button", { name: "Create Firestore database" }));
    const firestoreId = mocks.startBackendSetup.mock.calls.at(-1)?.[0].join("-");
    await emitExit(`proc-${firestoreId}`, 0, "");
    await screen.findByRole("button", { name: "Firestore ready" });
    fireEvent.click(
      screen.getByRole("button", { name: "I enabled Email/Password and Google" }),
    );
    await screen.findByRole("button", { name: "Sign-in providers confirmed" });

    const save = () =>
      fireEvent.click(screen.getByRole("button", { name: "Save backend credentials" }));

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
    await screen.findByText("Saving backend credentials failed: env denied");
    save();
    await screen.findByText("Saving backend credentials failed: Unknown error");
    save();
    await screen.findByText("Saving OAuth credentials failed: oauth denied");
    save();
    await screen.findByText("Saving OAuth credentials failed: Unknown error");
    save();
    await screen.findByText("env exploded");
    save();
    await screen.findByText("Failed to save credentials");
  });

  it("reports deploy failures and exceptions", async () => {
    const { BackendSetup } = await signIn();
    await setProject("my-proj");
    fireEvent.click(screen.getByRole("button", { name: "I upgraded to Blaze" }));
    await screen.findByRole("button", { name: "Blaze plan confirmed" });
    fireEvent.click(screen.getByRole("button", { name: "Create Firestore database" }));
    const firestoreId = mocks.startBackendSetup.mock.calls.at(-1)?.[0].join("-");
    await emitExit(`proc-${firestoreId}`, 0, "");
    await screen.findByRole("button", { name: "Firestore ready" });
    fireEvent.click(
      screen.getByRole("button", { name: "I enabled Email/Password and Google" }),
    );
    await screen.findByRole("button", { name: "Sign-in providers confirmed" });
    fireEvent.click(screen.getByRole("button", { name: "Save backend credentials" }));
    await screen.findByRole("button", { name: "Credentials saved" });

    const clickDeploy = () =>
      fireEvent.click(screen.getByRole("button", { name: "Deploy backend" }));

    mocks.startBackendSetup.mockResolvedValueOnce({ id: "d1" });
    clickDeploy();
    await emitExit("d1", 1, "", "deploy denied");
    await screen.findByText("deploy denied");

    mocks.startBackendSetup.mockResolvedValueOnce({ id: "d1b" });
    clickDeploy();
    await emitExit("d1b", 1, "");
    await screen.findByText("Deploy failed. Check the log below.");

    mocks.startBackendSetup.mockRejectedValueOnce(new Error("deploy exploded"));
    clickDeploy();
    await screen.findByText("deploy exploded");

    mocks.startBackendSetup.mockRejectedValueOnce("deploy weird");
    clickDeploy();
    await screen.findByText("Failed to deploy");

    await emitExit("unknown-process-id", 0, "");
    emitOutput("unknown-process-id", "plain log output without a login url");
  });
});
