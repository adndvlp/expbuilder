import { act, render, screen, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";
import {
  registerExperimentPreviewLifecycle,
  requestBodyFromLastPreviewPost,
} from "./testHarness";
import ExperimentPreview from "../../../pages/ExperimentBuilder/components/ExperimentPreview";
registerExperimentPreviewLifecycle();

it("resizes the running iframe without rebuilding or reloading it", async () => {
  const { rerender } = render(
    <ExperimentPreview
      autoStart
      previewViewport={{ width: 1440, height: 900 }}
      appearance={{
        backgroundColor: "#ffffff",
        fullScreen: true,
        progressBar: false,
      }}
    />,
  );
  await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
  await act(async () => {
    await Promise.resolve();
  });
  const iframe = screen.getByTitle("Experiment Preview");
  rerender(
    <ExperimentPreview
      autoStart
      previewViewport={{ width: 1478, height: 903 }}
      appearance={{
        backgroundColor: "#ffffff",
        fullScreen: true,
        progressBar: false,
      }}
    />,
  );
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.getByTitle("Experiment Preview")).toBe(iframe);
  expect(iframe).toHaveStyle({ width: "1478px", height: "903px" });
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  expect(requestBodyFromLastPreviewPost().canvasStyles).toEqual({
    backgroundColor: "#ffffff",
    fullScreen: true,
    progressBar: false,
  });
});
