import { afterEach, describe, expect, it, vi } from "vitest";
import AudioComponent from "../components/AudioComponent";
import { preloadAudioBuffer } from "../utils/AudioTiming";
import { createFakeAudioContext } from "./helpers/fakeAudioContext";
import { createFrameEngine } from "@expbuilder-jspsych/packages/jspsych/src/timeline/FrameEngine";

const REFRESH_RATES = [59.94, 60.1, 144, 165, 240];
const TEST_BUFFER = { duration: 2, sampleRate: 48_000 };

describe("visual/audio boundary integration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each(REFRESH_RATES)(
    "re-arms one effective audio source to the response-selected visual frame at %p Hz",
    async (refreshHz) => {
      let now = 0;
      let rafCallback: FrameRequestCallback | null = null;
      const engine = createFrameEngine({
        now: () => now,
        expectedFrameMs: 1000 / refreshHz,
        warmup: false,
        requestAnimationFrame: (callback) => {
          rafCallback = callback;
          return 1;
        },
        cancelAnimationFrame: () => {
          rafCallback = null;
        },
        postTask: (task) => task(),
      });
      const fire = (timestamp: number) => {
        expect(rafCallback).not.toBeNull();
        now = timestamp;
        const callback = rafCallback!;
        rafCallback = null;
        callback(timestamp);
      };
      vi.spyOn(performance, "now").mockImplementation(() => now);
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
        }),
      );
      const audioContext = createFakeAudioContext({
        currentTime: 0.5,
        baseLatency: 0,
        outputTimestamp: { contextTime: 0.5, performanceTime: 0 },
      });
      (audioContext.decodeAudioData as any) = vi
        .fn()
        .mockResolvedValue(TEST_BUFFER);
      const url = `boundary-${refreshHz}.wav`;
      await preloadAudioBuffer(audioContext as any, url, 1000);

      const getAudioPlayer = vi.fn();
      const audio = new AudioComponent({
        pluginAPI: {
          audioContext: () => audioContext,
          getAudioPlayer,
        },
      } as any);
      const audioDeadline = vi.fn();
      audio.prepare(document.body, {
        stimulus: url,
        autoplay: true,
        show_controls: false,
        __timing: { setNextAudioDeadline: audioDeadline },
      });
      expect(getAudioPlayer).not.toHaveBeenCalled();

      const arms: Array<{
        targetTime: number;
        predictedSelectedFrameTime: number;
      }> = [];
      const visualActivations: number[] = [];
      const a = engine.createTrialContext({
        id: `A-${refreshHz}`,
        trialIndex: 0,
        continuous: true,
        allowEarlyActivation: true,
      });
      const b = engine.createTrialContext({
        id: `B-${refreshHz}`,
        trialIndex: 1,
        continuous: true,
        allowEarlyActivation: true,
      });
      b.setPresentationLifecycle({
        arm(info) {
          arms.push({
            targetTime: info.targetTime,
            predictedSelectedFrameTime: info.predictedSelectedFrameTime,
          });
          audio.arm({
            scheduledTimestamp: info.targetTime,
            predictedSelectedFrameTime: info.predictedSelectedFrameTime,
          });
        },
        activate(info) {
          visualActivations.push(info.timestamp);
          audio.activate({ timestamp: info.timestamp });
        },
        deactivate() {
          audio.deactivate();
        },
      });
      a.onStart(() => {
        a.requestBoundary({
          targetTimeMs: 50,
          boundaryPolicy: "nearest_frame",
          reason: "timeout",
        });
      });
      a.markReady(0);
      b.markReady(0);
      a.start();
      const period = 1000 / refreshHz;
      fire(0);
      for (let frame = 1; frame * period < 27.2; frame += 1) {
        fire(frame * period);
      }

      now = 27.2;
      expect(
        a.replaceBoundary({
          targetTimeMs: 27.2,
          targetFrameIndex: a.getFrameIndex()! + 1,
          boundaryPolicy: "nearest_frame",
          reason: "response",
          requestedAt: 27.2,
        }),
      ).toBe(true);
      expect(arms).toHaveLength(2);
      const selected = arms[1].predictedSelectedFrameTime;
      expect(selected).toBeGreaterThan(27.2);
      fire(selected);

      expect(visualActivations).toEqual([selected]);
      expect(audioContext.createdSources).toHaveLength(2);
      expect(audioContext.createdSources[0].stopArgs.at(-1)).toBe(-1);
      expect(audioContext.createdSources[1].startArgs).toHaveLength(1);
      const diagnostics = audio.getDiagnostics();
      expect(diagnostics).toMatchObject({
        audio_requested_ideal_performance_time: 27.2,
        audio_rearmed: true,
        audio_rearm_count: 1,
      });
      expect(diagnostics.audio_predicted_selected_frame_time).toBeCloseTo(
        selected,
        3,
      );
      expect(diagnostics.audio_requested_performance_time).toBeCloseTo(
        selected,
        3,
      );
      expect(engine.getTransitions().at(-1)).toMatchObject({
        target_time: 27.2,
        actual_rAF_timestamp: selected,
        actual_frame_index: expect.any(Number),
      });
      expect(audioDeadline).toHaveBeenLastCalledWith(null);

      audio.destroy();
      b.stop();
    },
  );
});
