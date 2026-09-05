import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  defaultApi,
  emitExit,
  emitOutput,
  importBackendSetup,
  installBackendSetupHooks,
  mocks,
  setUpBackend,
  signIn,
} from "./testHarness";

describe("coverage settings: BackendSetup deploy", () => {
  installBackendSetupHooks();

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
