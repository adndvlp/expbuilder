import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import VideoComponent from "../components/VideoComponent";
import { createPrecisionTiming } from "../utils/PrecisionTiming";
import { installFakeRaf, restoreFakeRaf } from "./helpers/fakeRaf";

describe("VideoComponent presentation telemetry", () => {
  let callbacks: Array<(now: number, metadata: any) => void>;

  beforeEach(() => {
    installFakeRaf();
    callbacks = [];
    Object.defineProperty(
      HTMLVideoElement.prototype,
      "requestVideoFrameCallback",
      {
        configurable: true,
        value: vi.fn((callback: (now: number, metadata: any) => void) => {
          callbacks.push(callback);
          return callbacks.length;
        }),
      },
    );
    Object.defineProperty(
      HTMLVideoElement.prototype,
      "cancelVideoFrameCallback",
      {
        configurable: true,
        value: vi.fn(),
      },
    );
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  });

  afterEach(() => {
    restoreFakeRaf();
    vi.restoreAllMocks();
    delete (HTMLVideoElement.prototype as any).requestVideoFrameCallback;
    delete (HTMLVideoElement.prototype as any).cancelVideoFrameCallback;
    document.body.innerHTML = "";
  });

  it("keeps play request, first frame callback and expected display time distinct", async () => {
    vi.spyOn(performance, "now").mockReturnValue(110);
    const timing = createPrecisionTiming({ expectedFrameMs: 1000 / 60 });
    timing.startAt(100, "fresh_raf");
    const component = new VideoComponent({
      pluginAPI: { getVideoBuffer: vi.fn(() => null) },
    } as any);

    const video = component.render(document.body, {
      name: "Video_1",
      type: "VideoComponent",
      stimulus: ["clip.mp4"],
      autoplay: true,
      controls: false,
      start: null,
      stop: null,
      rate: 1,
      coordinates: { x: 0, y: 0 },
      __timing: timing,
      __componentId: "video-target",
    });
    video.dispatchEvent(new Event("loadeddata"));
    await Promise.resolve();

    expect(component.getDiagnostics().video_play_request_abs).toBe(110);
    expect(
      component.getDiagnostics().video_first_frame_callback_abs,
    ).toBeNull();
    expect(timing.getSummary().stimulusRecords[0].frame_onset_abs).toBeNull();

    callbacks[0](120, {
      mediaTime: 0.04,
      expectedDisplayTime: 121.5,
      presentedFrames: 1,
    });

    const diagnostics = component.getDiagnostics();
    expect(diagnostics.video_first_frame_callback_abs).toBe(120);
    expect(diagnostics.video_first_frame_media_time).toBe(0.04);
    expect(diagnostics.video_first_frame_expected_display_time).toBe(121.5);
    expect(diagnostics.video_first_frame_presented_frames).toBe(1);
    expect(diagnostics.physical_video_onset_abs).toBeNull();
    expect(timing.getSummary().stimulusRecords[0]).toEqual(
      expect.objectContaining({
        frame_onset_abs: 120,
        timestamp_semantics: "video_frame_callback",
        physical_onset_abs: null,
      }),
    );

    component.stop();
    expect(component.getDiagnostics().video_stop_request_abs).toBe(110);
    expect(component.getDiagnostics().video_last_frame_callback_abs).toBe(120);
    component.destroy();
    timing.stop();
  });
});
