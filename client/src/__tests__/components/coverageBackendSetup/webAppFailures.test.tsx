import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  emitAppsList,
  emitExit,
  emitProjectResult,
  fillProject,
  installBackendSetupHooks,
  mocks,
  sdkOutput,
  signIn,
} from "./testHarness";

describe("coverage settings: BackendSetup web app failures", () => {
  installBackendSetupHooks();

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
});
