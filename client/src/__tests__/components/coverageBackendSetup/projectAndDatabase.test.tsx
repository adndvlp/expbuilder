import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  defaultApi,
  emitExit,
  emitProjectResult,
  emitWebAppSuccess,
  fillProject,
  installBackendSetupHooks,
  mocks,
  setUpBackend,
  signIn,
} from "./testHarness";

describe("coverage settings: BackendSetup project and database", () => {
  installBackendSetupHooks();

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
});
