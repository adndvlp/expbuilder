import {
  docSnap,
  mocks,
  registerSettingsOAuthTokensHooks,
} from "./testHarness";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import OsfToken from "../../../pages/Settings/OsfToken";
import { fetchOAuthState } from "../../../lib/oauthState";
import { openExternal } from "../../../lib/openExternal";

describe("Settings OAuth tokens", () => {
  registerSettingsOAuthTokensHooks();

  it("shows OSF OAuth state errors inline without opening a provider window", async () => {
    mocks.fetchOAuthState.mockRejectedValueOnce(new Error("state unavailable"));

    render(<OsfToken />);

    fireEvent.click(
      await screen.findByRole("button", { name: /Connect with OSF OAuth/ }),
    );

    expect(
      await screen.findByText("Could not start OAuth flow: state unavailable"),
    ).toBeInTheDocument();
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("renders OSF disconnected state without a signed-in user and ignores OAuth clicks", async () => {
    mocks.auth.currentUser = null;

    render(<OsfToken />);

    expect(await screen.findByText(/Not Connected/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /Connect with OSF OAuth/ }),
    );

    expect(fetchOAuthState).not.toHaveBeenCalled();
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("handles a missing OSF document and a valid manual token", async () => {
    mocks.getDoc.mockResolvedValueOnce({
      exists: () => false,
      data: () => ({}),
    });
    const missingView = render(<OsfToken />);

    expect(await screen.findByText(/Not Connected/)).toBeInTheDocument();
    missingView.unmount();

    mocks.getDoc.mockResolvedValueOnce(
      docSnap({ osfToken: "manual-token", osfTokenValid: true }),
    );
    render(<OsfToken />);

    expect(await screen.findByText(/Connected/)).toBeInTheDocument();
  });

  it("validates empty OSF manual tokens before saving", async () => {
    render(<OsfToken />);

    fireEvent.click(
      await screen.findByText("Use Personal Access Token instead"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Enter Manual Token" }));
    fireEvent.change(
      screen.getByPlaceholderText("Parent Project ID (e.g., abc12)"),
      {
        target: { value: "abc12" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Token" }));

    expect(
      await screen.findAllByText("Please enter a valid token"),
    ).toHaveLength(2);
    expect(fetch).not.toHaveBeenCalled();
  });
});
