import {
  docSnap,
  mocks,
  registerSettingsOAuthElectronFlowsHooks,
} from "./testHarness";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("Settings OAuth Electron flows", () => {
  registerSettingsOAuthElectronFlowsHooks();

  it("exchanges OSF Electron OAuth codes and reloads saved token metadata", async () => {
    mocks.getDoc.mockResolvedValueOnce(docSnap({})).mockResolvedValueOnce(
      docSnap({
        osfTokens: { access_token: "osf-token" },
        osfUserName: "OSF User",
        osfProjectId: "abc12",
      }),
    );
    const { default: OsfToken } = await import(
      "../../../pages/Settings/OsfToken"
    );

    render(<OsfToken />);

    fireEvent.click(
      await screen.findByRole("button", { name: /Connect with OSF OAuth/ }),
    );
    expect(
      await screen.findByText(
        "Opening OSF authorization... If it fails, it will retry automatically.",
      ),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect((window as any).electron.startOAuthFlow).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "osf",
          state: "signed-state-123",
        }),
      );
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("osfOAuthCallback"),
      );
    });

    const url = vi.mocked(fetch).mock.calls.at(-1)?.[0] as string;
    expect(url).toContain("code=auth-code");
    expect(url).toContain("state=signed-state-123");
    expect(url).toContain(
      `redirect_uri=${encodeURIComponent("http://localhost:8888/callback")}`,
    );
    expect(window.alert).toHaveBeenCalledWith(
      "OSF connected successfully via OAuth!",
    );
    expect(await screen.findByText(/OSF User/)).toBeInTheDocument();
  });

  it("finishes OSF Electron exchange when the refreshed document is missing", async () => {
    mocks.getDoc.mockResolvedValueOnce(docSnap({})).mockResolvedValueOnce({
      exists: () => false,
      data: () => ({}),
    });
    const { default: OsfToken } = await import(
      "../../../pages/Settings/OsfToken"
    );

    render(<OsfToken />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Connect with OSF OAuth/ }),
    );

    await waitFor(
      () => {
        expect(window.alert).toHaveBeenCalledWith(
          "OSF connected successfully via OAuth!",
        );
      },
      { timeout: 2500 },
    );
    expect(screen.getByText(/Not Connected/)).toBeInTheDocument();
  });

  it("defaults sparse OSF metadata after Electron exchange", async () => {
    mocks.getDoc
      .mockResolvedValueOnce(docSnap({}))
      .mockResolvedValueOnce(
        docSnap({ osfTokens: { access_token: "osf-token" } }),
      );
    const { default: OsfToken } = await import(
      "../../../pages/Settings/OsfToken"
    );

    render(<OsfToken />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Connect with OSF OAuth/ }),
    );

    await waitFor(
      () => {
        expect(window.alert).toHaveBeenCalledWith(
          "OSF connected successfully via OAuth!",
        );
      },
      { timeout: 2500 },
    );
    expect(screen.getByTitle("Valid OSF Token")).toBeInTheDocument();
    expect(screen.queryByText(/Project:/)).not.toBeInTheDocument();
  });
});
