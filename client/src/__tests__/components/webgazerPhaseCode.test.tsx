import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Trial } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/types";
import {
  evaluateWebgazerPhase,
  normalize,
  useWebgazerPhaseHarness,
  webgazerTrial,
} from "./webgazerPhaseCode/testHarness";

describe("generatePhaseCode for WebGazer phases", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("generates a normal WebGazer phase with optional instructions and unquoted function params", () => {
    const { result } = renderHook(() =>
      useWebgazerPhaseHarness({
        pluginName: "plugin-webgazer-init-camera",
        instructions: [
          {
            key: "plugin_webgazer_init_camera_instructions",
            label: "Instructions",
            type: "html_string",
            default: "<p>Default instructions</p>",
          },
          {
            key: "plugin_webgazer_init_camera_choices",
            label: "Choices",
            type: "string_array",
            default: ["Continue"],
          },
        ],
        initialMapping: {
          message: { source: "typed", value: "<p>Ready</p>" },
          button_html: {
            source: "typed",
            value: "(choice) => `<button>${choice}</button>`",
          },
          plugin_webgazer_init_camera_instructions: {
            source: "typed",
            value: "<p>Camera instructions</p>",
          },
          plugin_webgazer_init_camera_choices: {
            source: "typed",
            value: ["Start"],
          },
        },
      }),
    );

    act(() => result.current.phase.setIncludeInstructions(true));

    const code = normalize(result.current.phase.trialCode);

    expect(result.current.phase.mappedJson).toEqual([
      {
        message: "<p>Ready</p>",
        button_html: "(choice) => `<button>${choice}</button>`",
        plugin_webgazer_init_camera_instructions: "<p>Camera instructions</p>",
        plugin_webgazer_init_camera_choices: ["Start"],
      },
    ]);
    expect(code).toContain("type: jsPsychWebgazerInitCamera");
    expect(code).toContain(
      'stimulus: jsPsych.timelineVariable("plugin_webgazer_init_camera_instructions")',
    );
    expect(code).toContain(
      "button_html: (choice) => `<button>${choice}</button>`",
    );
    expect(code).toContain(
      "plugin_webgazer_init_camera_instructions, plugin_webgazer_init_camera_timeline",
    );
  });

  it("generates validate phases with validate task data and raw_gaze cleanup", () => {
    const { result } = renderHook(() =>
      useWebgazerPhaseHarness({
        pluginName: "plugin-webgazer-validate",
        initialMapping: {
          validation_points: {
            source: "typed",
            value: [
              [20, 20],
              [80, 20],
            ],
          },
        },
      }),
    );

    const code = normalize(result.current.phase.trialCode);

    expect(result.current.phase.mappedJson).toEqual([
      {
        validation_points: [
          [20, 20],
          [80, 20],
        ],
      },
    ]);
    expect(code).toContain("type: jsPsychWebgazerValidate");
    expect(code).toContain("data: { task: 'validate' }");
    expect(code).toContain(
      "on_finish: function(data) { delete data.raw_gaze; }",
    );
  });

  it("restores selected trial state and clears the loading flag after the delay", () => {
    vi.useFakeTimers();
    const selectedTrial = {
      id: 11,
      type: "webgazer",
      name: undefined,
      plugin: "webgazer",
      parameters: {
        include_instructions: {
          "plugin-webgazer-init-camera": true,
        },
        minimum_percent: 82,
      },
      trialCode: "",
      columnMapping: {
        message: { source: "typed", value: "<p>Stored</p>" },
      },
      csvJson: [{ message: "Stored row" }],
      csvColumns: ["message"],
    } as unknown as Trial;

    const { result } = renderHook(() =>
      useWebgazerPhaseHarness({
        pluginName: "plugin-webgazer-init-camera",
        selectedTrial,
      }),
    );

    expect(result.current.trialName).toBe("");
    expect(result.current.phase.includeInstructions).toBe(true);
    expect(result.current.phase.minimumPercentAcceptable).toBe(82);
    expect(result.current.columnMapping).toEqual(selectedTrial.columnMapping);
    expect(result.current.csvJson).toEqual(selectedTrial.csvJson);
    expect(result.current.csvColumns).toEqual(["message"]);
    expect(result.current.isLoadingTrial).toBe(true);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.isLoadingTrial).toBe(false);
  });

  it("maps CSV rows into timeline variables", () => {
    const { result } = renderHook(() =>
      useWebgazerPhaseHarness({
        pluginName: "plugin-webgazer-validate",
        initialCsvJson: [{ points: "[10,20], [30,40]" }],
        initialMapping: {
          validation_points: {
            source: "csv",
            value: "points",
          },
        },
      }),
    );

    expect(result.current.phase.mappedJson).toEqual([
      {
        validation_points: [
          [10, 20],
          [30, 40],
        ],
      },
    ]);
    expect(normalize(result.current.phase.trialCode)).toContain(
      "const test_stimuli_plugin_webgazer_validate = [{validation_points: [[10,20],[30,40]]}]",
    );
  });

  it("takes branch parameters from the coordinator for loop trials without a parent loop id", () => {
    vi.useFakeTimers();
    const selectedTrial = webgazerTrial({
      id: 12,
      name: "Loop trial",
      isInLoop: true,
    });

    const { result } = renderHook(() =>
      useWebgazerPhaseHarness({
        pluginName: "plugin-webgazer-init-camera",
        selectedTrial,
      }),
    );

    const takeParameters = vi.fn(() => ({
      message: { source: "typed", value: "Override" },
    }));
    const phase = evaluateWebgazerPhase(
      result.current.phase.trialCode,
      "plugin_webgazer_init_camera_timeline",
      { ExpBuilderNavigation: { takeParameters } },
    );
    const trial = { data: { builder_id: 12 }, message: "Original" };
    phase.on_start(trial);
    expect(takeParameters).toHaveBeenCalledExactlyOnceWith(12);
    expect(trial.message).toBe("Override");

    act(() => {
      vi.advanceTimersByTime(100);
    });
  });

  it("delegates final recalibration branching to the coordinator when parentLoopId exists", () => {
    const selectedTrial = webgazerTrial({
      id: 10,
      name: "Eye tracking",
      parentLoopId: "loop-A",
      branches: [99],
    });

    const { result } = renderHook(() =>
      useWebgazerPhaseHarness({
        pluginName: "plugin-webgazer-recalibrate",
        selectedTrial,
      }),
    );

    act(() => result.current.phase.setMinimumPercentAcceptable(75));

    const code = normalize(result.current.phase.trialCode);

    expect(code).toContain("var minimum_percent_acceptable = 75;");
    expect(code).toContain("timeline.push(recalibrate_timeline);");
    expect(code).toContain("timeline.push(calibration_done);");
    const decision = {
      targetId: 99,
      conditionId: null,
      customParameters: null,
      usedDefault: true,
    };
    const decide = vi.fn(() => decision);
    const requestBranch = vi.fn();
    const done = evaluateWebgazerPhase(
      result.current.phase.trialCode,
      "calibration_done",
      {
        ExpBuilderBranching: { decide },
        ExpBuilderNavigation: { requestBranch },
      },
    );
    const data = { builder_id: 10, response: "go" };
    done.on_finish(data);
    expect(decide).toHaveBeenCalledExactlyOnceWith(data, [99], []);
    expect(requestBranch).toHaveBeenCalledExactlyOnceWith(data, decision);
  });

  it("generates recalibration instructions from mapped values and fallbacks", () => {
    const instructions = [
      {
        key: "plugin_webgazer_recalibrate_instructions",
        label: "Instructions",
        type: "html_string",
        default: "<p>Look again</p>",
      },
      {
        key: "plugin_webgazer_recalibrate_choices",
        label: "Choices",
        type: "string_array",
        default: ["Retry"],
      },
    ];
    const { result } = renderHook(() =>
      useWebgazerPhaseHarness({
        pluginName: "plugin-webgazer-recalibrate",
        instructions,
      }),
    );

    act(() => result.current.phase.setIncludeInstructions(true));

    const code = normalize(result.current.phase.trialCode);
    expect(code).toContain("const plugin_webgazer_recalibrate_instructions =");
    expect(code).toContain('stimulus: "<p>Look again</p>"');
    expect(code).toContain('choices: ["Retry"]');
    expect(code).toContain(
      "plugin_webgazer_recalibrate_instructions, plugin_webgazer_calibrate_procedure",
    );

    const { result: fallbackResult } = renderHook(() =>
      useWebgazerPhaseHarness({
        pluginName: "plugin-webgazer-recalibrate",
      }),
    );

    act(() => fallbackResult.current.phase.setIncludeInstructions(true));

    const fallbackCode = normalize(fallbackResult.current.phase.trialCode);
    expect(fallbackCode).toContain('stimulus: ""');
    expect(fallbackCode).toContain('choices: ["OK"]');
  });
});
