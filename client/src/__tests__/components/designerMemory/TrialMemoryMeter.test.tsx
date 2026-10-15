import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import TrialMemoryMeter from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/memory/TrialMemoryMeter";
import type { TrialComponent } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";
import { readMediaMetadata } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/memory/readMediaMetadata";

vi.mock("../../../pages/ExperimentBuilder/hooks/useExperimentID", () => ({
  useExperimentID: () => "E1",
}));
vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/memory/readMediaMetadata",
  () => ({ readMediaMetadata: vi.fn() }),
);

const image = (id: string, source = "img/photo.png"): TrialComponent => ({
  id,
  type: "ImageComponent",
  config: { stimulus: { source: "typed", value: source } },
  width: 100,
  height: 100,
  x: 0,
  y: 0,
});
beforeEach(() => {
  vi.mocked(readMediaMetadata).mockReset();
  vi.mocked(readMediaMetadata).mockResolvedValue({
    sizeBytes: 1200,
    width: 4000,
    height: 3000,
  });
});

it("updates the calculated resources when adding, duplicating, resizing or deleting components", async () => {
  const original = image("first");
  const { rerender } = render(<TrialMemoryMeter components={[original]} />);
  await screen.findByText("48.0 MB calculated base");
  expect(readMediaMetadata).toHaveBeenCalledTimes(1);
  rerender(
    <TrialMemoryMeter
      components={[{ ...original, width: 10, height: 10 }, image("second")]}
    />,
  );
  expect(screen.getByText("48.0 MB calculated base")).toBeInTheDocument();
  expect(screen.getByText("2 components · 1 unique media")).toBeInTheDocument();
  expect(readMediaMetadata).toHaveBeenCalledTimes(1);
  rerender(
    <TrialMemoryMeter
      components={[original, image("third", "img/other.png")]}
    />,
  );
  await screen.findByText("96.0 MB calculated base");
  expect(readMediaMetadata).toHaveBeenCalledTimes(2);
  rerender(<TrialMemoryMeter components={[original]} />);
  expect(screen.getByText("48.0 MB calculated base")).toBeInTheDocument();
  rerender(<TrialMemoryMeter components={[]} />);
  expect(screen.getByText("0.0 KB calculated base")).toBeInTheDocument();
});

it("marks inaccessible media as unknown and allows refreshing actual file metadata", async () => {
  vi.mocked(readMediaMetadata).mockRejectedValueOnce(new Error("Unavailable"));
  render(<TrialMemoryMeter components={[image("first")]} />);
  await screen.findByText("Metadata unavailable");
  expect(screen.getByText("Not yet measurable")).toBeInTheDocument();
  expect(screen.getByText("Partial estimate")).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Refresh file metadata" }),
  );
  await screen.findByText("48.0 MB calculated base");
  expect(readMediaMetadata).toHaveBeenCalledTimes(2);
});

it("warns near the advisory reference based on intrinsic image resolution", async () => {
  vi.mocked(readMediaMetadata).mockResolvedValue({
    sizeBytes: 1200,
    width: 18000,
    height: 18000,
  });
  render(<TrialMemoryMeter components={[image("first")]} />);
  await screen.findByText("Near the iPhone reference");
  expect(screen.getByText("1.30 GB calculated base")).toBeInTheDocument();
  expect(
    screen.getByText(
      /actual limit varies with device and system memory pressure/,
    ),
  ).toBeInTheDocument();
});

it("inspects at most two resources concurrently and cancels pending work on unmount", async () => {
  const signals: AbortSignal[] = [];
  let finishFirst: (() => void) | undefined;
  vi.mocked(readMediaMetadata).mockImplementation(
    (_resource, _experiment, _api, signal) =>
      new Promise((resolve, reject) => {
        signals.push(signal);
        signal.addEventListener(
          "abort",
          () => reject(new DOMException("Cancelled", "AbortError")),
          { once: true },
        );
        finishFirst ??= () => resolve({ width: 100, height: 100 });
      }),
  );
  const { unmount } = render(
    <TrialMemoryMeter
      components={[
        image("a", "img/a.png"),
        image("b", "img/b.png"),
        image("c", "img/c.png"),
      ]}
    />,
  );
  expect(readMediaMetadata).toHaveBeenCalledTimes(2);
  await act(async () => finishFirst?.());
  await waitFor(() => expect(readMediaMetadata).toHaveBeenCalledTimes(3));
  unmount();
  expect(signals.slice(1).every((signal) => signal.aborted)).toBe(true);
});
