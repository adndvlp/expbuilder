import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ResetAppButton, {
  resolveResetApiUrl,
} from "../../pages/Settings/ResetAppButton";
import { auth } from "../../lib/firebase";

function okJson(payload: unknown): Response {
  return {
    ok: true,
    json: vi.fn(async () => payload),
  } as unknown as Response;
}

function fetchMock() {
  return vi.mocked(globalThis.fetch);
}

const originalLocation = window.location;

describe("ResetAppButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn(async () =>
      okJson({ success: false, error: "Reset failed" }),
    ) as unknown as typeof fetch;
    vi.spyOn(window, "alert").mockImplementation(() => {});
    (auth as any).currentUser = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    (auth as any).currentUser = null;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("opens and cancels the destructive confirmation without sending requests", () => {
    expect(resolveResetApiUrl("")).toBe("http://localhost:3000");
    expect(resolveResetApiUrl("https://api.test")).toBe("https://api.test");

    render(<ResetAppButton />);

    fireEvent.click(screen.getByText("Delete all my data"));

    expect(screen.getByText("Are you absolutely sure?")).toBeInTheDocument();
    expect(screen.queryByText(/Also delete my GitHub/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Cancel"));

    expect(screen.queryByText("Are you absolutely sure?")).not.toBeInTheDocument();
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("posts a reset request without repo deletion when no user is logged in", async () => {
    render(<ResetAppButton />);

    fireEvent.click(screen.getByText("Delete all my data"));
    fireEvent.click(screen.getByText("Yes, permanently delete"));

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        "http://localhost:3000/api/app/reset",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid: null,
            deleteRepos: false,
          }),
        },
      );
    });
    expect(window.alert).toHaveBeenCalledWith(
      "Ocurrió un error borrando la app: Reset failed",
    );
  });

  it("includes uid and deleteRepos when a logged-in user opts into repo deletion", async () => {
    (auth as any).currentUser = { uid: "user-123" };

    render(<ResetAppButton />);

    fireEvent.click(screen.getByText("Delete all my data"));
    fireEvent.click(screen.getByLabelText(/Also delete my GitHub/));
    fireEvent.click(screen.getByText("Yes, permanently delete"));

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        "http://localhost:3000/api/app/reset",
        expect.objectContaining({
          body: JSON.stringify({
            uid: "user-123",
            deleteRepos: true,
          }),
        }),
      );
    });
  });

  it("clears browser storage and reloads after a successful reset", async () => {
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { reload },
    });
    fetchMock().mockResolvedValueOnce(okJson({ success: true }));
    const localClear = vi.fn();
    const sessionClear = vi.fn();
    vi.stubGlobal("localStorage", { clear: localClear });
    vi.stubGlobal("sessionStorage", { clear: sessionClear });

    render(<ResetAppButton />);

    fireEvent.click(screen.getByText("Delete all my data"));
    fireEvent.click(screen.getByText("Yes, permanently delete"));

    await waitFor(() => {
      expect(localClear).toHaveBeenCalled();
      expect(sessionClear).toHaveBeenCalled();
      expect(reload).toHaveBeenCalled();
    });
  });

  it("alerts when the reset request cannot reach the server", async () => {
    fetchMock().mockRejectedValueOnce(new Error("offline"));

    render(<ResetAppButton />);

    fireEvent.click(screen.getByText("Delete all my data"));
    fireEvent.click(screen.getByText("Yes, permanently delete"));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        "Error crítico conectando con el servidor",
      );
    });
  });
});
