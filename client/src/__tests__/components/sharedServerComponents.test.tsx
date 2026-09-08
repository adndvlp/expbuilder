import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createConnectionCode } from "../../lib/serverConnection";
import ServerSharing from "../../pages/Settings/components/ServerSharing";
import SharedServerConnect from "../../pages/Settings/components/SharedServerConnect";

const firebaseConfig = {
  apiKey: "api-key",
  authDomain: "shared-lab.firebaseapp.com",
  projectId: "shared-lab",
  storageBucket: "shared-lab.appspot.com",
  messagingSenderId: "123456",
  appId: "1:123456:web:abc",
};

function installElectron(api: Partial<ElectronAPI>) {
  window.electron = api as ElectronAPI;
}

afterEach(() => {
  vi.restoreAllMocks();
  delete window.electron;
  Object.defineProperty(navigator, "clipboard", {
    value: undefined,
    configurable: true,
  });
});

describe("shared server controls", () => {
  it("connects an unconfigured desktop app with a pasted code", async () => {
    const writeFirebaseConfig = vi.fn(async () => ({ success: true }));
    const restartApp = vi.fn(async () => ({ success: true }));
    installElectron({
      readFirebaseConfig: vi.fn(async () => null),
      writeFirebaseConfig,
      restartApp,
    });

    render(<SharedServerConnect />);
    const input = await screen.findByLabelText("Connection code");
    fireEvent.change(input, {
      target: { value: createConnectionCode(firebaseConfig) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() =>
      expect(writeFirebaseConfig).toHaveBeenCalledWith({
        ...firebaseConfig,
        connectionMode: "member",
      }),
    );
    expect(restartApp).toHaveBeenCalled();
    expect(
      screen.getByText("Connected. ExpBuilder is restarting…"),
    ).toBeInTheDocument();
  });

  it("shows a simple error for a bad code and hides when already configured", async () => {
    installElectron({
      readFirebaseConfig: vi.fn(async () => null),
      writeFirebaseConfig: vi.fn(),
    });
    const { unmount } = render(<SharedServerConnect />);
    const input = await screen.findByLabelText("Connection code");
    fireEvent.change(input, { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This connection code is not valid.",
    );
    unmount();

    installElectron({
      readFirebaseConfig: vi.fn(async () => firebaseConfig),
    });
    render(<SharedServerConnect />);
    await waitFor(() =>
      expect(
        screen.queryByTestId("shared-server-connect"),
      ).not.toBeInTheDocument(),
    );
  });

  it("creates and copies the code shown by the server owner", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    installElectron({
      readFirebaseConfig: vi.fn(async () => ({
        ...firebaseConfig,
        connectionMode: "owner",
      })),
    });

    render(<ServerSharing projectId="shared-lab" />);
    const codeField = await screen.findByLabelText("Server connection code");
    fireEvent.click(
      screen.getByRole("button", { name: "Copy connection code" }),
    );

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        (codeField as HTMLTextAreaElement).value,
      ),
    );
    expect(screen.getByText("Connection code copied.")).toBeInTheDocument();
  });
});
