import {
  okResponse,
  registerSettingsOAuthElectronFlowsHooks,
} from "./testHarness";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("Settings OAuth Electron flows", () => {
  registerSettingsOAuthElectronFlowsHooks();

  it("uses the default OSF Electron OAuth failure message", async () => {
    (window as any).electron.startOAuthFlow.mockResolvedValue({
      success: false,
    });
    const { default: OsfToken } = await import(
      "../../../pages/Settings/OsfToken"
    );

    render(<OsfToken />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Connect with OSF OAuth/ }),
    );

    expect(
      await screen.findByText(
        "Connection failed: OAuth flow failed",
        {},
        { timeout: 2500 },
      ),
    ).toBeInTheDocument();
  });

  it("reports OSF Electron token exchange failures inline", async () => {
    vi.mocked(fetch).mockResolvedValue(okResponse(false));
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

    expect(
      await screen.findByText(
        "Connection failed: Failed to exchange tokens",
        {},
        { timeout: 2500 },
      ),
    ).toBeInTheDocument();
    expect(console.error).toHaveBeenCalledWith(
      "Error connecting OSF:",
      expect.any(Error),
    );
  });

  it("retries OSF Electron invalid_client responses and then shows configuration guidance", async () => {
    (window as any).electron.startOAuthFlow.mockResolvedValue({
      success: false,
      error: "invalid_client: pending propagation",
    });
    const { default: OsfToken } = await import(
      "../../../pages/Settings/OsfToken"
    );

    render(<OsfToken />);

    fireEvent.click(
      await screen.findByRole("button", { name: /Connect with OSF OAuth/ }),
    );

    await screen.findByText(
      "Opening OSF authorization... If it fails, it will retry automatically.",
    );

    expect(
      await screen.findByText(
        "OSF configuration is propagating... Retrying (attempt 2/3)",
        {},
        { timeout: 2500 },
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        "OSF configuration is propagating... Retrying (attempt 3/3)",
        {},
        { timeout: 4500 },
      ),
    ).toBeInTheDocument();

    expect(
      await screen.findByText(
        /OSF OAuth configuration error/,
        {},
        { timeout: 4500 },
      ),
    ).toBeInTheDocument();
    expect((window as any).electron.startOAuthFlow).toHaveBeenCalledTimes(3);
  }, 10_000);
});
