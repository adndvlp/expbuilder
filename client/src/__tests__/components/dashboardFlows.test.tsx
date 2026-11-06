import { routerMocks, okJson, fetchMock } from "./dashboardTestHarness";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "../../pages/Dashboard";
import { auth, subscribeToAuth } from "../../lib/firebase";

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(subscribeToAuth).mockImplementation((callback) => {
      callback((auth as any).currentUser);
      return vi.fn();
    });
    (auth as any).currentUser = {
      uid: "user-123",
      getIdToken: vi.fn(async () => "firebase-id-token"),
    };
    vi.spyOn(window, "confirm").mockReturnValue(true);
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "http://localhost:3000/api/load-experiments") {
        return okJson({
          experiments: [
            { experimentID: "exp-1", name: "Memory Task" },
            { experimentID: "exp-2", name: "Visual Search" },
          ],
        });
      }
      if (url === "http://localhost:3000/api/create-experiment") {
        return okJson({
          success: true,
          experiment: { experimentID: "exp-3", name: "New Study" },
        });
      }
      if (
        url === "http://localhost:3000/api/delete-experiment/exp-1" &&
        init?.method === "DELETE"
      ) {
        return okJson({ success: true });
      }
      return okJson({});
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    (auth as any).currentUser = null;
  });

  it("loads experiments, opens selected experiments and menu routes", async () => {
    render(<Dashboard />);

    expect(await screen.findByText("Memory Task")).toBeInTheDocument();
    expect(screen.getByText("Visual Search")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Memory Task"));
    expect(routerMocks.navigate).toHaveBeenCalledWith("/home/experiment/exp-1");

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.click(screen.getByText("Settings"));
    expect(routerMocks.navigate).toHaveBeenCalledWith("/settings");

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.click(screen.getByText("Documentation"));
    expect(routerMocks.navigate).toHaveBeenCalledWith("/docs");
  });

  it("creates an experiment from the prompt modal and appends it to the list", async () => {
    render(<Dashboard />);

    await screen.findByText("Memory Task");
    fireEvent.click(screen.getByText("+ Create experiment"));
    fireEvent.change(screen.getByPlaceholderText("Enter experiment name"), {
      target: { value: "  New Study  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        "http://localhost:3000/api/create-experiment",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "New Study" }),
        },
      );
    });
    expect(await screen.findByText("New Study")).toBeInTheDocument();
  });

  it("closes the create experiment prompt without creating when cancelled", async () => {
    render(<Dashboard />);

    await screen.findByText("Memory Task");
    fireEvent.click(screen.getByText("+ Create experiment"));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
      screen.queryByPlaceholderText("Enter experiment name"),
    ).not.toBeInTheDocument();
    expect(fetchMock()).not.toHaveBeenCalledWith(
      "http://localhost:3000/api/create-experiment",
      expect.anything(),
    );
  });

  it("does not delete experiments when confirmation is cancelled", async () => {
    vi.mocked(window.confirm).mockReturnValueOnce(false);

    render(<Dashboard />);

    await screen.findByText("Memory Task");
    fireEvent.click(
      screen.getAllByRole("button", {
        name: "Delete experiment and published resources…",
      })[0],
    );

    expect(fetchMock()).not.toHaveBeenCalledWith(
      "http://localhost:3000/api/delete-experiment/exp-1",
      expect.anything(),
    );
    expect(screen.getByText("Memory Task")).toBeInTheDocument();
  });

  it("deletes experiments with the authenticated uid without triggering navigation", async () => {
    render(<Dashboard />);

    await screen.findByText("Memory Task");
    fireEvent.click(
      screen.getAllByRole("button", {
        name: "Delete experiment and published resources…",
      })[0],
    );

    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining(
        "permanently delete the associated GitHub repository",
      ),
    );
    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        "http://localhost:3000/api/delete-experiment/exp-1",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer firebase-id-token",
          },
          body: JSON.stringify({ scope: "remote", uid: "user-123" }),
        },
      );
    });
    await waitFor(() => {
      expect(screen.queryByText("Memory Task")).not.toBeInTheDocument();
    });
    expect(routerMocks.navigate).not.toHaveBeenCalledWith(
      "/home/experiment/exp-1",
    );
  });

  it("handles an empty experiment response and unsuccessful creation", async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url === "http://localhost:3000/api/load-experiments") {
        return okJson({});
      }
      if (url === "http://localhost:3000/api/create-experiment") {
        return okJson({ success: false });
      }
      return okJson({});
    }) as unknown as typeof fetch;

    render(<Dashboard />);

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        "http://localhost:3000/api/load-experiments",
      );
    });
    expect(screen.queryByText("Memory Task")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("+ Create experiment"));
    fireEvent.change(screen.getByPlaceholderText("Enter experiment name"), {
      target: { value: "Rejected Study" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        "http://localhost:3000/api/create-experiment",
        expect.any(Object),
      );
    });
    expect(screen.queryByText("Rejected Study")).not.toBeInTheDocument();
  });

  it("keeps an experiment when unauthenticated deletion fails", async () => {
    (auth as any).currentUser = null;
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "http://localhost:3000/api/load-experiments") {
        return okJson({
          experiments: [{ experimentID: "exp-fail", name: "Keep Study" }],
        });
      }
      if (
        url === "http://localhost:3000/api/delete-experiment/exp-fail" &&
        init?.method === "DELETE"
      ) {
        return okJson({ success: false }, false);
      }
      return okJson({});
    }) as unknown as typeof fetch;

    render(<Dashboard />);

    expect(await screen.findByText("Keep Study")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Delete from this device" }),
    );

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        "http://localhost:3000/api/delete-experiment/exp-fail",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope: "local" }),
        },
      );
    });
    expect(screen.getByText("Keep Study")).toBeInTheDocument();
  });
  it("deletes only the local copy when explicitly selected, even while signed in", async () => {
    render(<Dashboard />);
    await screen.findByText("Memory Task");
    fireEvent.click(
      screen.getAllByRole("button", { name: "Delete from this device" })[0],
    );
    await waitFor(() =>
      expect(screen.queryByText("Memory Task")).not.toBeInTheDocument(),
    );
    expect(fetchMock()).toHaveBeenCalledWith(
      "http://localhost:3000/api/delete-experiment/exp-1",
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "local" }),
      },
    );
    expect((auth as any).currentUser.getIdToken).not.toHaveBeenCalled();
  });

  it("shows a remote ownership error and preserves the experiment", async () => {
    const previous = fetchMock().getMockImplementation()!;
    fetchMock().mockImplementation(async (input, init) => {
      if (init?.method === "DELETE")
        return okJson(
          {
            code: "EXPERIMENT_FORBIDDEN",
            message: "You do not own this experiment",
          },
          false,
        );
      return previous(input, init);
    });
    render(<Dashboard />);
    await screen.findByText("Memory Task");
    fireEvent.click(
      screen.getAllByRole("button", {
        name: "Delete experiment and published resources…",
      })[0],
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You do not own this experiment",
    );
    expect(screen.getByText("Memory Task")).toBeInTheDocument();
    expect(screen.getByText("+ Create experiment")).not.toBeDisabled();
  });
});
