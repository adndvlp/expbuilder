import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  emitExit,
  emitOutput,
  importBackendSetup,
  installBackendSetupHooks,
  mocks,
} from "./testHarness";

describe("coverage settings: BackendSetup login", () => {
  installBackendSetupHooks();

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
});
