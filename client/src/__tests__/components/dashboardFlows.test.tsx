import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "../../pages/Dashboard";
import { PromptModal } from "../../pages/Dashboard/PromptModal";
import { auth } from "../../lib/firebase";

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => routerMocks.navigate,
    Outlet: () => <div data-testid="outlet" />,
  };
});

function okJson(payload: unknown, ok = true): Response {
  return {
    ok,
    json: vi.fn(async () => payload),
  } as unknown as Response;
}

function fetchMock() {
  return vi.mocked(globalThis.fetch);
}

describe("PromptModal", () => {
  it("confirms trimmed values, blocks blank input and cancels from overlay or Escape", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { rerender, container } = render(
      <PromptModal
        isOpen={false}
        title="Experiment name:"
        placeholder="Enter name"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.queryByText("Experiment name:")).not.toBeInTheDocument();

    rerender(
      <PromptModal
        isOpen
        title="Experiment name:"
        placeholder="Enter name"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText("Enter name"), {
      target: { value: "  Memory Task  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(onConfirm).toHaveBeenCalledWith("Memory Task");

    fireEvent.keyDown(container.querySelector(".prompt-modal-content")!, {
      key: "Escape",
    });
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(container.querySelector(".prompt-modal-overlay")!);
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as any).currentUser = { uid: "user-123" };
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

  it("refreshes experiments when chat changes experiment data", async () => {
    render(<Dashboard />);

    await screen.findByText("Memory Task");
    fetchMock().mockClear();

    window.dispatchEvent(new Event("experiment-data-changed"));

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        "http://localhost:3000/api/load-experiments",
      );
    });
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

  it("deletes experiments with the authenticated uid without triggering navigation", async () => {
    render(<Dashboard />);

    await screen.findByText("Memory Task");
    fireEvent.click(screen.getAllByText("Delete")[0]);

    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining("permanently delete the associated GitHub repository"),
    );
    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        "http://localhost:3000/api/delete-experiment/exp-1",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid: "user-123" }),
        },
      );
    });
    expect(screen.queryByText("Memory Task")).not.toBeInTheDocument();
    expect(routerMocks.navigate).not.toHaveBeenCalledWith(
      "/home/experiment/exp-1",
    );
  });
});
