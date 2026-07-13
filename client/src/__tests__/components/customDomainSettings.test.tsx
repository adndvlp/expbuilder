import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CustomDomainSettings from "../../pages/ExperimentPanel/CustomDomainSettings";

function okJson(payload: unknown): Response {
  return {
    ok: true,
    json: vi.fn(async () => payload),
  } as unknown as Response;
}

function fetchMock() {
  return vi.mocked(globalThis.fetch);
}

describe("CustomDomainSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  it("loads tunnel settings and saves a sanitized hostname", async () => {
    fetchMock()
      .mockResolvedValueOnce(
        okJson({
          success: true,
          settings: {
            hostname: "old.example.com",
            persistent: true,
          },
        }),
      )
      .mockResolvedValueOnce(
        okJson({
          success: true,
          settings: {
            hostname: "new.example.com",
            persistent: true,
          },
        }),
      );

    render(<CustomDomainSettings experimentID="exp-123" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("old.example.com")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Hostname/), {
      target: { value: "https://new.example.com/" },
    });
    expect(screen.getByLabelText("Keep tunnel always on")).toBeChecked();

    fireEvent.click(screen.getByText("Save Settings"));

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenLastCalledWith(
        "http://localhost:3000/api/tunnel-settings/exp-123",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hostname: "new.example.com",
            persistent: true,
          }),
        },
      );
    });
    expect(await screen.findByText("Settings saved!")).toBeInTheDocument();
    expect(screen.getByDisplayValue("new.example.com")).toBeInTheDocument();
  });

  it("uses defaults for partial loaded settings and handles load failures", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock().mockResolvedValueOnce(
      okJson({
        success: true,
        settings: {},
      }),
    );

    render(<CustomDomainSettings experimentID="exp-123" />);

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        "http://localhost:3000/api/tunnel-settings/exp-123",
      );
    });
    expect(screen.queryByLabelText("Keep tunnel always on")).not.toBeInTheDocument();

    fetchMock().mockRejectedValueOnce(new Error("load failed"));
    render(<CustomDomainSettings experimentID="exp-456" />);

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        "Error loading tunnel settings:",
        expect.any(Error),
      );
    });
  });

  it("forces persistent false when saving an empty hostname", async () => {
    fetchMock()
      .mockResolvedValueOnce(okJson({ success: false }))
      .mockResolvedValueOnce(
        okJson({
          success: true,
          settings: { hostname: "", persistent: false },
        }),
      );

    render(<CustomDomainSettings experimentID="exp-123" />);

    fireEvent.click(screen.getByText("Save Settings"));

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenLastCalledWith(
        "http://localhost:3000/api/tunnel-settings/exp-123",
        expect.objectContaining({
          body: JSON.stringify({ hostname: "", persistent: false }),
        }),
      );
    });
  });

  it("clears tunnel settings and shows save errors", async () => {
    fetchMock()
      .mockResolvedValueOnce(
        okJson({
          success: true,
          settings: { hostname: "old.example.com", persistent: true },
        }),
      )
      .mockResolvedValueOnce(
        okJson({
          success: true,
          settings: { hostname: "", persistent: false },
        }),
      )
      .mockResolvedValueOnce(
        okJson({
          success: false,
          error: "Cannot save tunnel",
        }),
      );

    render(<CustomDomainSettings experimentID="exp-123" />);

    await waitFor(() => {
      expect(screen.getByText("Clear")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Clear"));

    expect(await screen.findByText("Settings cleared.")).toBeInTheDocument();
    expect(screen.queryByText("Clear")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Hostname/), {
      target: { value: "bad.example.com" },
    });
    fireEvent.click(screen.getByText("Save Settings"));

    expect(await screen.findByText("Cannot save tunnel")).toBeInTheDocument();
  });

  it("updates persistence and shows generic save and clear errors", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock()
      .mockResolvedValueOnce(
        okJson({
          success: true,
          settings: { hostname: "old.example.com", persistent: false },
        }),
      )
      .mockResolvedValueOnce(okJson({ success: false }))
      .mockResolvedValueOnce(okJson({ success: false }))
      .mockRejectedValueOnce(new Error("save failed"))
      .mockRejectedValueOnce(new Error("clear failed"));

    render(<CustomDomainSettings experimentID="exp-123" />);

    const persistent = await screen.findByLabelText("Keep tunnel always on");
    fireEvent.click(persistent);
    expect(persistent).toBeChecked();

    fireEvent.click(screen.getByText("Save Settings"));
    expect(await screen.findByText("Error saving settings.")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Clear"));
    expect(await screen.findByText("Error clearing settings.")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Save Settings"));
    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        "Error saving tunnel settings:",
        expect.any(Error),
      );
    });

    fireEvent.click(screen.getByText("Clear"));
    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        "Error clearing tunnel settings:",
        expect.any(Error),
      );
    });
  });

  it("does not fetch or save without an experiment id", () => {
    render(<CustomDomainSettings experimentID={undefined} />);

    fireEvent.change(screen.getByLabelText(/Hostname/), {
      target: { value: "example.com" },
    });
    fireEvent.click(screen.getByText("Save Settings"));
    fireEvent.click(screen.getByText("Clear"));

    expect(fetchMock()).not.toHaveBeenCalled();
  });
});
