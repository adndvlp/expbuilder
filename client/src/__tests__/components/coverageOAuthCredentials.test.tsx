import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const customConfig = {
  githubClientId: "gh-1",
  dropboxClientId: "db-1",
  googleDriveClientId: "drive-1",
  osfClientId: "osf-1",
};

function fillOAuthForm(overrides: Partial<typeof customConfig> = {}) {
  const values = { ...customConfig, ...overrides };
  fireEvent.change(screen.getByPlaceholderText("Enter github client id"), {
    target: { value: values.githubClientId },
  });
  fireEvent.change(screen.getByPlaceholderText("Enter dropbox client id"), {
    target: { value: values.dropboxClientId },
  });
  fireEvent.change(screen.getByPlaceholderText("Enter google drive client id"), {
    target: { value: values.googleDriveClientId },
  });
  fireEvent.change(screen.getByPlaceholderText("Enter osf client id"), {
    target: { value: values.osfClientId },
  });
}

async function importOAuthCredentials() {
  vi.resetModules();
  return (await import("../../pages/Settings/OAuthCredentials")).default;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  delete (window as any).electron;
});

describe("coverage settings: OAuthCredentials", () => {
  it("shows the non-Electron availability message", async () => {
    delete (window as any).electron;
    const OAuthCredentials = await importOAuthCredentials();

    render(<OAuthCredentials />);

    expect(
      screen.getByText(
        "Custom OAuth credentials are only available in the Electron app.",
      ),
    ).toBeInTheDocument();
  });

  it("loads custom credentials, edits fields and saves successfully", async () => {
    const writeOauthConfig = vi.fn(async () => ({ success: true }));
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    (window as any).electron = {
      readOauthConfig: vi.fn(async () => customConfig),
      writeOauthConfig,
      deleteOauthConfig: vi.fn(),
    };
    const OAuthCredentials = await importOAuthCredentials();

    render(<OAuthCredentials />);

    await screen.findByText("✓ Using custom OAuth credentials");
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.change(screen.getByPlaceholderText("Enter github client id"), {
      target: { value: "updated-gh" },
    });
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() =>
      expect(writeOauthConfig).toHaveBeenCalledWith({
        ...customConfig,
        githubClientId: "updated-gh",
      }),
    );
    expect(alert).toHaveBeenCalledWith(
      "OAuth credentials saved successfully! Please restart the app for changes to take effect.",
    );
    expect(
      screen.queryByPlaceholderText("Enter github client id"),
    ).not.toBeInTheDocument();
  });

  it("validates required fields and reloads config on cancel", async () => {
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    const readOauthConfig = vi.fn(async () => null);
    (window as any).electron = {
      readOauthConfig,
      writeOauthConfig: vi.fn(),
      deleteOauthConfig: vi.fn(),
    };
    const OAuthCredentials = await importOAuthCredentials();

    render(<OAuthCredentials />);

    await screen.findByText("No custom OAuth credentials configured");
    fireEvent.click(screen.getByText("Set Credentials"));
    fireEvent.click(screen.getByText("Save"));
    expect(alert).toHaveBeenCalledWith("Please fill in all fields");

    fireEvent.click(screen.getByText("Cancel"));
    await waitFor(() => expect(readOauthConfig).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("Save")).not.toBeInTheDocument();
  });

  it("logs OAuth config load failures and still leaves the default state", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const loadError = new Error("read failed");
    (window as any).electron = {
      readOauthConfig: vi.fn(async () => Promise.reject(loadError)),
      writeOauthConfig: vi.fn(),
      deleteOauthConfig: vi.fn(),
    };
    const OAuthCredentials = await importOAuthCredentials();

    render(<OAuthCredentials />);

    await screen.findByText("No custom OAuth credentials configured");
    expect(consoleError).toHaveBeenCalledWith(
      "Error loading OAuth config:",
      loadError,
    );
  });

  it("reports OAuth save failures and thrown save errors", async () => {
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    const writeOauthConfig = vi
      .fn()
      .mockResolvedValueOnce({ success: false, error: "disk full" })
      .mockResolvedValueOnce({ success: false })
      .mockRejectedValueOnce(new Error("write exploded"))
      .mockRejectedValueOnce("unknown write failure");
    (window as any).electron = {
      readOauthConfig: vi.fn(async () => null),
      writeOauthConfig,
      deleteOauthConfig: vi.fn(),
    };
    const OAuthCredentials = await importOAuthCredentials();

    render(<OAuthCredentials />);

    await screen.findByText("No custom OAuth credentials configured");
    fireEvent.click(screen.getByText("Set Credentials"));
    fillOAuthForm();

    fireEvent.click(screen.getByText("Save"));
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith("Error saving credentials: disk full"),
    );

    fireEvent.click(screen.getByText("Save"));
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        "Error saving credentials: Unknown error",
      ),
    );

    fireEvent.click(screen.getByText("Save"));
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        "Error saving credentials: write exploded",
      ),
    );

    fireEvent.click(screen.getByText("Save"));
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        "Error saving credentials: Unknown error",
      ),
    );
  });

  it("removes custom credentials after confirmation", async () => {
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const deleteOauthConfig = vi.fn(async () => ({ success: true }));
    (window as any).electron = {
      readOauthConfig: vi.fn(async () => customConfig),
      writeOauthConfig: vi.fn(),
      deleteOauthConfig,
    };
    const OAuthCredentials = await importOAuthCredentials();

    render(<OAuthCredentials />);

    await screen.findByText("✓ Using custom OAuth credentials");
    fireEvent.click(screen.getByText("Remove"));

    await waitFor(() => expect(deleteOauthConfig).toHaveBeenCalled());
    expect(confirm).toHaveBeenCalledWith(
      "Are you sure you want to remove your OAuth credentials? The app will need to be restarted.",
    );
    expect(alert).toHaveBeenCalledWith(
      "OAuth credentials removed! Please restart the app for changes to take effect.",
    );
    expect(
      screen.getByText("No custom OAuth credentials configured"),
    ).toBeInTheDocument();
  });

  it("cancels and reports OAuth removal failures", async () => {
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    const confirm = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true);
    const deleteOauthConfig = vi
      .fn()
      .mockResolvedValueOnce({ success: false, error: "delete denied" })
      .mockResolvedValueOnce({ success: false })
      .mockRejectedValueOnce(new Error("delete exploded"))
      .mockRejectedValueOnce("unknown delete failure");
    (window as any).electron = {
      readOauthConfig: vi.fn(async () => customConfig),
      writeOauthConfig: vi.fn(),
      deleteOauthConfig,
    };
    const OAuthCredentials = await importOAuthCredentials();

    render(<OAuthCredentials />);

    await screen.findByText("✓ Using custom OAuth credentials");
    fireEvent.click(screen.getByText("Remove"));
    expect(deleteOauthConfig).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Remove"));
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        "Error removing credentials: delete denied",
      ),
    );

    fireEvent.click(screen.getByText("Remove"));
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        "Error removing credentials: Unknown error",
      ),
    );

    fireEvent.click(screen.getByText("Remove"));
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        "Error removing credentials: delete exploded",
      ),
    );

    fireEvent.click(screen.getByText("Remove"));
    await waitFor(() => expect(deleteOauthConfig).toHaveBeenCalledTimes(4));
    expect(alert).toHaveBeenLastCalledWith(
      "Error removing credentials: Unknown error",
    );
    expect(confirm).toHaveBeenCalledTimes(5);
  });
});
