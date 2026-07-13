import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { generatePhaseCode } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/Webgazer/generatePhaseCode";
import type {
  ColumnMapping,
  Trial,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/types";

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/hooks/usePluginParameters",
  () => ({
    usePluginParameters: vi.fn((pluginName: string) => {
      const metadata: Record<
        string,
        {
          parameters: Array<{ key: string; label: string; type: string; default?: unknown }>;
          data: Array<{ key: string; label: string; type: string }>;
        }
      > = {
        "plugin-webgazer-init-camera": {
          parameters: [
            { key: "message", label: "Message", type: "html_string", default: "" },
            { key: "button_html", label: "Button HTML", type: "function", default: "" },
          ],
          data: [{ key: "phase", label: "Phase", type: "string" }],
        },
        "plugin-webgazer-validate": {
          parameters: [
            {
              key: "validation_points",
              label: "Validation Points",
              type: "number_array",
              default: [],
            },
          ],
          data: [{ key: "percent_in_roi", label: "Percent ROI", type: "number_array" }],
        },
        "plugin-webgazer-recalibrate": {
          parameters: [],
          data: [],
        },
      };

      return {
        parameters: metadata[pluginName]?.parameters ?? [],
        data: metadata[pluginName]?.data ?? [],
        loading: false,
        error: null,
      };
    }),
  }),
);

function normalize(code: string) {
  return code.replace(/\s+/g, " ").trim();
}

function useWebgazerPhaseHarness({
  pluginName,
  instructions = [],
  initialMapping = {},
  initialCsvJson = [],
  selectedTrial = null,
}: {
  pluginName: string;
  instructions?: Array<{ key: string; label: string; type: string; default?: unknown }>;
  initialMapping?: ColumnMapping;
  initialCsvJson?: any[];
  selectedTrial?: Trial | null;
}) {
  const [csvJson, setCsvJson] = useState(initialCsvJson);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [trialName, setTrialName] = useState("");
  const [columnMapping, setColumnMapping] =
    useState<ColumnMapping>(initialMapping);
  const [isLoadingTrial, setIsLoadingTrial] = useState(false);

  const phase = generatePhaseCode({
    pluginName,
    instructions,
    csvJson,
    setCsvJson,
    selectedTrial,
    setTrialName,
    setCsvColumns,
    columnMapping,
    setColumnMapping,
    setIsLoadingTrial,
  });

  return {
    phase,
    csvJson,
    csvColumns,
    trialName,
    columnMapping,
    isLoadingTrial,
  };
}

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
    expect(code).toContain("button_html: (choice) => `<button>${choice}</button>`");
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
    expect(code).toContain("on_finish: function(data) { delete data.raw_gaze; }");
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

  it("uses base branch variable names for loop trials without a parent loop id", () => {
    vi.useFakeTimers();
    const selectedTrial = {
      id: 12,
      type: "webgazer",
      name: "Loop trial",
      plugin: "webgazer",
      parameters: {},
      trialCode: "",
      isInLoop: true,
    } as unknown as Trial;

    const { result } = renderHook(() =>
      useWebgazerPhaseHarness({
        pluginName: "plugin-webgazer-init-camera",
        selectedTrial,
      }),
    );

    expect(normalize(result.current.phase.trialCode)).toContain(
      "typeof BranchCustomParameters !== 'undefined'",
    );
    expect(result.current.phase.trialCode).not.toContain("loop_");

    act(() => {
      vi.advanceTimersByTime(100);
    });
  });

  it("scopes final recalibration branching to parent loop variables when parentLoopId exists", () => {
    const selectedTrial: Trial = {
      id: 10,
      type: "webgazer",
      name: "Eye tracking",
      plugin: "webgazer",
      parameters: {},
      trialCode: "",
      parentLoopId: "loop-A",
      branches: [99],
    };

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
    expect(code).toContain("loop_loop_A_NextTrialId = branches[0];");
    expect(code).toContain("loop_loop_A_SkipRemaining = true;");
    expect(code).not.toContain("window.nextTrialId = branches[0];");
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
    expect(code).toContain("plugin_webgazer_recalibrate_instructions, plugin_webgazer_calibrate_procedure");

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
