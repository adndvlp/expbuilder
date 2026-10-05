import { afterEach, describe, expect, it, vi } from "vitest";
import { renderExperimentBaseCode } from "../../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/generateExperimentBaseCode";
import type { UploadedFile } from "../../../pages/ExperimentBuilder/utils/codegen/types";

function runGeneratedExperiment(
  files: UploadedFile[],
  codes = ['timeline.push({ type: "generated-trial" });'],
) {
  const run = vi.fn<(timeline: unknown[]) => void>();
  const services = {
    collect: vi.fn(),
    reserveImages: vi.fn(),
    prepareAV: vi.fn(),
  };
  const dynamic = { mediaPreparationServices: vi.fn(() => services) };
  const code = renderExperimentBaseCode(codes, files, {
    backgroundColor: "#fff",
    fullScreen: false,
    progressBar: false,
  });
  new Function("jsPsych", "DynamicPlugin", code)(
    { run, pluginAPI: {} },
    dynamic,
  );
  expect(run).toHaveBeenCalledOnce();
  return { timeline: run.mock.calls[0][0], dynamic, services, code };
}

afterEach(() => {
  delete (window as Window & { ExpBuilderMediaPreparation?: unknown })
    .ExpBuilderMediaPreparation;
});

describe("generated media preparation", () => {
  it("passes typed media references to the coordinator without loading the library or inserting trials", () => {
    const files = [
      { url: "img/portrait.png", type: "img" },
      { url: "aud/alert.mp3", type: "aud" },
      { url: "vid/clip.mp4", type: "vid" },
      { url: "others/rows.csv", type: "others" },
      { name: "missing.png", type: "img" },
    ];
    const { timeline, dynamic, services, code } = runGeneratedExperiment(files);
    expect(timeline).toEqual([{ type: "generated-trial" }]);
    expect(dynamic.mediaPreparationServices).toHaveBeenCalledWith(
      expect.anything(),
      files.slice(0, 3),
    );
    expect(services.collect).not.toHaveBeenCalled();
    expect(services.reserveImages).not.toHaveBeenCalled();
    expect(services.prepareAV).not.toHaveBeenCalled();
    expect(code).not.toContain("globalPreload");
  });

  it("preserves signed URLs and supports experiments without DynamicPlugin", () => {
    const url = "https://cdn.test/download?token=abc&file=portrait%20%22one%22";
    const { code } = runGeneratedExperiment([{ url, type: "img" }]);
    const run = vi.fn();
    new Function("jsPsych", code)({ run, pluginAPI: {} });
    expect(run).toHaveBeenCalledWith([{ type: "generated-trial" }]);
    expect(code).toContain(JSON.stringify(url));
  });

  it("keeps manual preload trials intact", () => {
    const { timeline } = runGeneratedExperiment(
      [],
      [
        'timeline.push({ type: { info: { name: "preload" } }, images: ["manual.png"] });',
      ],
    );
    expect(timeline).toEqual([
      {
        type: { info: { name: "preload" } },
        images: ["manual.png"],
        on_start: expect.any(Function),
      },
    ]);
  });
});
