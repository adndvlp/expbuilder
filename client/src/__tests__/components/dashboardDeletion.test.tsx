import { okJson, fetchMock } from "./dashboardTestHarness";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "../../pages/Dashboard";
import { auth, subscribeToAuth } from "../../lib/firebase";

describe("Explicit deletion scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(subscribeToAuth).mockImplementation((callback) => {
      callback((auth as any).currentUser);
      return vi.fn();
    });
    (auth as any).currentUser = {
      uid: "owner",
      getIdToken: vi.fn(async () => "token"),
    };
    vi.spyOn(window, "confirm").mockReturnValue(true);
    globalThis.fetch = vi.fn(async (_url, init) =>
      okJson(
        init?.method === "DELETE"
          ? { success: true }
          : { experiments: [{ experimentID: "one", name: "Study" }] },
      ),
    ) as typeof fetch;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    (auth as any).currentUser = null;
  });

  it("keeps remote deletion unavailable without sign-in and offers an explicit local action", async () => {
    (auth as any).currentUser = null;
    render(<Dashboard />);
    await screen.findByText("Study");
    const remote = screen.getByRole("button", {
      name: "Delete experiment and published resources…",
    });
    expect(remote).toBeDisabled();
    expect(
      screen.getByText("Sign in to delete published resources."),
    ).toBeInTheDocument();
    fireEvent.click(remote);
    expect(window.confirm).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Delete from this device" }),
    );
    await waitFor(() =>
      expect(screen.queryByText("Study")).not.toBeInTheDocument(),
    );
    expect(fetchMock()).toHaveBeenCalledWith(
      expect.stringContaining("/api/delete-experiment/one"),
      expect.objectContaining({ body: JSON.stringify({ scope: "local" }) }),
    );
  });

  it("never changes remote deletion into local deletion when the session disappears", async () => {
    render(<Dashboard />);
    await screen.findByText("Study");
    (auth as any).currentUser = null;
    fireEvent.click(
      screen.getByRole("button", {
        name: "Delete experiment and published resources…",
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(/Sign in/);
    expect(screen.getByText("Study")).toBeInTheDocument();
    expect(
      fetchMock().mock.calls.some(([, init]) => init?.method === "DELETE"),
    ).toBe(false);
  });

  it("stops remote deletion if the account changes while obtaining the token", async () => {
    let resolveToken!: (value: string) => void;
    (auth as any).currentUser.getIdToken = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveToken = resolve;
        }),
    );
    render(<Dashboard />);
    await screen.findByText("Study");
    fireEvent.click(
      screen.getByRole("button", {
        name: "Delete experiment and published resources…",
      }),
    );
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringMatching(/GitHub repository and data storage folder/),
    );
    (auth as any).currentUser = null;
    resolveToken("token");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Sign in|account changed/i,
    );
    expect(
      fetchMock().mock.calls.some(([, init]) => init?.method === "DELETE"),
    ).toBe(false);
    expect(screen.getByText("Study")).toBeInTheDocument();
  });
});
