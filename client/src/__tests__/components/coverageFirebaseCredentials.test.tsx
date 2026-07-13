import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const customConfig = {
  apiKey: "api-key",
  authDomain: "auth.firebaseapp.com",
  projectId: "project-id",
  storageBucket: "bucket.appspot.com",
  messagingSenderId: "sender-id",
  appId: "app-id",
};

function fillFirebaseForm(overrides: Partial<typeof customConfig> = {}) {
  const values = { ...customConfig, ...overrides };
  fireEvent.change(screen.getByPlaceholderText("Enter api key"), {
    target: { value: values.apiKey },
  });
  fireEvent.change(screen.getByPlaceholderText("Enter auth domain"), {
    target: { value: values.authDomain },
  });
  fireEvent.change(screen.getByPlaceholderText("Enter project id"), {
    target: { value: values.projectId },
  });
  fireEvent.change(screen.getByPlaceholderText("Enter storage bucket"), {
    target: { value: values.storageBucket },
  });
  fireEvent.change(screen.getByPlaceholderText("Enter messaging sender id"), {
    target: { value: values.messagingSenderId },
  });
  fireEvent.change(screen.getByPlaceholderText("Enter app id"), {
    target: { value: values.appId },
  });
}

async function importFirebaseCredentials() {
  vi.resetModules();
  return (await import("../../pages/Settings/FirebaseCredentials")).default;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  delete (window as any).electron;
});

describe("coverage settings: FirebaseCredentials", () => {
  it("shows the non-Electron availability message", async () => {
    delete (window as any).electron;
    const FirebaseCredentials = await importFirebaseCredentials();

    render(<FirebaseCredentials />);

    expect(
      screen.getByText(
        "Custom Firebase credentials are only available in the Electron app.",
      ),
    ).toBeInTheDocument();
  });

  it("loads custom credentials, edits fields and saves successfully", async () => {
    const writeFirebaseConfig = vi.fn(async () => ({ success: true }));
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    (window as any).electron = {
      readFirebaseConfig: vi.fn(async () => customConfig),
      writeFirebaseConfig,
      deleteFirebaseConfig: vi.fn(),
    };
    const FirebaseCredentials = await importFirebaseCredentials();

    render(<FirebaseCredentials />);

    await screen.findByText("✓ Using custom Firebase credentials");
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.change(screen.getByPlaceholderText("Enter api key"), {
      target: { value: "updated-key" },
    });
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() =>
      expect(writeFirebaseConfig).toHaveBeenCalledWith({
        ...customConfig,
        apiKey: "updated-key",
      }),
    );
    expect(alert).toHaveBeenCalledWith(
      "Firebase credentials saved successfully! Please restart the app for changes to take effect.",
    );
    expect(screen.queryByPlaceholderText("Enter api key")).not.toBeInTheDocument();
  });

  it("validates required fields and reloads config on cancel", async () => {
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    const readFirebaseConfig = vi.fn(async () => null);
    (window as any).electron = {
      readFirebaseConfig,
      writeFirebaseConfig: vi.fn(),
      deleteFirebaseConfig: vi.fn(),
    };
    const FirebaseCredentials = await importFirebaseCredentials();

    render(<FirebaseCredentials />);

    await screen.findByText("Using default Firebase credentials");
    fireEvent.click(screen.getByText("Set Custom Credentials"));
    fireEvent.click(screen.getByText("Save"));
    expect(alert).toHaveBeenCalledWith("Please fill in all fields");

    fireEvent.click(screen.getByText("Cancel"));
    await waitFor(() => expect(readFirebaseConfig).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("Save")).not.toBeInTheDocument();
  });

  it("logs Firebase config load failures and still leaves the default state", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const loadError = new Error("read failed");
    (window as any).electron = {
      readFirebaseConfig: vi.fn(async () => Promise.reject(loadError)),
      writeFirebaseConfig: vi.fn(),
      deleteFirebaseConfig: vi.fn(),
    };
    const FirebaseCredentials = await importFirebaseCredentials();

    render(<FirebaseCredentials />);

    await screen.findByText("Using default Firebase credentials");
    expect(consoleError).toHaveBeenCalledWith(
      "Error loading Firebase config:",
      loadError,
    );
  });

  it("reports Firebase save failures and thrown save errors", async () => {
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    const writeFirebaseConfig = vi
      .fn()
      .mockResolvedValueOnce({ success: false, error: "disk full" })
      .mockResolvedValueOnce({ success: false })
      .mockRejectedValueOnce(new Error("write exploded"))
      .mockRejectedValueOnce("unknown write failure");
    (window as any).electron = {
      readFirebaseConfig: vi.fn(async () => null),
      writeFirebaseConfig,
      deleteFirebaseConfig: vi.fn(),
    };
    const FirebaseCredentials = await importFirebaseCredentials();

    render(<FirebaseCredentials />);

    await screen.findByText("Using default Firebase credentials");
    fireEvent.click(screen.getByText("Set Custom Credentials"));
    fillFirebaseForm();

    fireEvent.click(screen.getByText("Save"));
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith("Error saving credentials: disk full"),
    );

    fireEvent.click(screen.getByText("Save"));
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith("Error saving credentials: Unknown error"),
    );

    fireEvent.click(screen.getByText("Save"));
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith("Error saving credentials: write exploded"),
    );

    fireEvent.click(screen.getByText("Save"));
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith("Error saving credentials: Unknown error"),
    );
  });

  it("resets custom credentials after confirmation", async () => {
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const deleteFirebaseConfig = vi.fn(async () => ({ success: true }));
    (window as any).electron = {
      readFirebaseConfig: vi.fn(async () => customConfig),
      writeFirebaseConfig: vi.fn(),
      deleteFirebaseConfig,
    };
    const FirebaseCredentials = await importFirebaseCredentials();

    render(<FirebaseCredentials />);

    await screen.findByText("✓ Using custom Firebase credentials");
    fireEvent.click(screen.getByText("Reset to Default"));

    await waitFor(() => expect(deleteFirebaseConfig).toHaveBeenCalled());
    expect(confirm).toHaveBeenCalledWith(
      "Are you sure you want to reset to default Firebase credentials? The app will need to be restarted.",
    );
    expect(alert).toHaveBeenCalledWith(
      "Firebase credentials reset to default! Please restart the app for changes to take effect.",
    );
    expect(screen.getByText("Using default Firebase credentials")).toBeInTheDocument();
  });

  it("cancels and reports Firebase reset failures", async () => {
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    const confirm = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true);
    const deleteFirebaseConfig = vi
      .fn()
      .mockResolvedValueOnce({ success: false, error: "delete denied" })
      .mockResolvedValueOnce({ success: false })
      .mockRejectedValueOnce(new Error("delete exploded"))
      .mockRejectedValueOnce("unknown delete failure");
    (window as any).electron = {
      readFirebaseConfig: vi.fn(async () => customConfig),
      writeFirebaseConfig: vi.fn(),
      deleteFirebaseConfig,
    };
    const FirebaseCredentials = await importFirebaseCredentials();

    render(<FirebaseCredentials />);

    await screen.findByText("✓ Using custom Firebase credentials");
    fireEvent.click(screen.getByText("Reset to Default"));
    expect(deleteFirebaseConfig).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Reset to Default"));
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        "Error resetting credentials: delete denied",
      ),
    );

    fireEvent.click(screen.getByText("Reset to Default"));
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        "Error resetting credentials: Unknown error",
      ),
    );

    fireEvent.click(screen.getByText("Reset to Default"));
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        "Error resetting credentials: delete exploded",
      ),
    );

    fireEvent.click(screen.getByText("Reset to Default"));
    await waitFor(() =>
      expect(deleteFirebaseConfig).toHaveBeenCalledTimes(4),
    );
    expect(alert).toHaveBeenLastCalledWith(
      "Error resetting credentials: Unknown error",
    );
    expect(confirm).toHaveBeenCalledTimes(5);
  });
});
