import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppearanceSettings from "../../pages/ExperimentPanel/AppearanceSettings";

vi.mock("react-switch", () => ({
  default: ({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) => (
    <button
      type="button"
      aria-label="toggle switch"
      data-checked={String(checked)}
      onClick={() => onChange(!checked)}
    />
  ),
}));

function okJson(payload: unknown): Response {
  return {
    ok: true,
    json: vi.fn(async () => payload),
  } as unknown as Response;
}

function fetchMock() {
  return vi.mocked(globalThis.fetch);
}

describe("AppearanceSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  it("loads saved appearance settings and persists edited values", async () => {
    fetchMock()
      .mockResolvedValueOnce(
        okJson({
          success: true,
          settings: {
            backgroundColor: "#123456",
            fullScreen: false,
            progressBar: true,
          },
        }),
      )
      .mockResolvedValueOnce(okJson({ success: true }));

    const { container } = render(<AppearanceSettings experimentID="exp-123" />);

    await waitFor(() => {
      expect(screen.getAllByDisplayValue("#123456")).toHaveLength(2);
    });

    const colorPicker = container.querySelector<HTMLInputElement>(
      'input[type="color"]',
    )!;
    fireEvent.change(colorPicker, { target: { value: "#654321" } });

    const colorTextInput = screen.getAllByDisplayValue("#654321")[1];
    fireEvent.change(colorTextInput, { target: { value: "#abcdef" } });

    const switches = screen.getAllByLabelText("toggle switch");
    expect(switches[0]).toHaveAttribute("data-checked", "false");
    expect(switches[1]).toHaveAttribute("data-checked", "true");

    fireEvent.click(switches[0]);
    fireEvent.click(switches[1]);
    fireEvent.click(screen.getByText("Save Appearance"));

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenLastCalledWith(
        "http://localhost:3000/api/appearance-settings/exp-123",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            backgroundColor: "#abcdef",
            fullScreen: true,
            progressBar: false,
          }),
        },
      );
    });
    expect(
      await screen.findByText("Appearance settings saved!"),
    ).toBeInTheDocument();
  });

  it("shows API and network errors when saving appearance settings", async () => {
    fetchMock()
      .mockResolvedValueOnce(okJson({ success: false }))
      .mockResolvedValueOnce(okJson({ success: false, error: "Bad settings" }))
      .mockRejectedValueOnce(new Error("network"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { rerender } = render(<AppearanceSettings experimentID="exp-123" />);

    fireEvent.click(screen.getByText("Save Appearance"));

    expect(await screen.findByText("Bad settings")).toBeInTheDocument();

    rerender(<AppearanceSettings experimentID="exp-456" />);
    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        "http://localhost:3000/api/appearance-settings/exp-456",
      );
    });

    fireEvent.click(screen.getByText("Save Appearance"));

    expect(await screen.findByText("Error saving settings.")).toBeInTheDocument();
  });

  it("uses appearance defaults and the generic API error message", async () => {
    fetchMock()
      .mockResolvedValueOnce(
        okJson({
          success: true,
          settings: {
            backgroundColor: null,
            fullScreen: null,
            progressBar: null,
          },
        }),
      )
      .mockResolvedValueOnce(okJson({ success: false }));

    render(<AppearanceSettings experimentID="exp-defaults" />);

    await waitFor(() => {
      expect(screen.getAllByDisplayValue("#ffffff")).toHaveLength(2);
    });
    const switches = screen.getAllByLabelText("toggle switch");
    expect(switches[0]).toHaveAttribute("data-checked", "true");
    expect(switches[1]).toHaveAttribute("data-checked", "false");

    fireEvent.click(screen.getByText("Save Appearance"));

    expect(await screen.findByText("Error saving settings.")).toBeInTheDocument();
  });

  it("does not fetch or save without an experiment id", () => {
    render(<AppearanceSettings experimentID={undefined} />);

    fireEvent.click(screen.getByText("Save Appearance"));

    expect(fetchMock()).not.toHaveBeenCalled();
  });
});
