import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePluginParameters } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/hooks/usePluginParameters";
import { mapMetadataToData, mapMetadataToFields } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/utils/metadataMapper";
import { loadPluginParameters } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/utils/pluginParameterLoader";

function createResponse(payload: unknown, ok = true): Response {
  return {
    ok,
    json: vi.fn(async () => payload),
  } as unknown as Response;
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

describe("plugin metadata loading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps metadata parameters and data into configuration definitions", () => {
    const fields = mapMetadataToFields({
      trial_duration: { type: "number", default: 500 },
      stimulus_audio: { type: "audio" },
      choices: { type: "string_array", default: ["f", "j"] },
      calibration_points: { type: "number_array", default: "__undefined__" },
      show_clickable_nav: { type: "boolean", default: false },
      stimuli: { type: "image_array", default: [] },
      prompt_pages: { type: "html_string_array", default: [] },
      survey_json: { type: "object" },
    });

    expect(fields).toEqual([
      {
        key: "trial_duration",
        label: "Trial Duration",
        type: "number",
        default: 500,
      },
      {
        key: "stimulus_audio",
        label: "Stimulus Audio",
        type: "string",
        default: null,
      },
      {
        key: "choices",
        label: "Choices",
        type: "string_array",
        default: ["f", "j"],
      },
      {
        key: "calibration_points",
        label: "Calibration Points",
        type: "number_array",
        default: undefined,
      },
      {
        key: "show_clickable_nav",
        label: "Show Clickable Nav",
        type: "boolean",
        default: false,
      },
      {
        key: "stimuli",
        label: "Stimuli",
        type: "string_array",
        default: [],
      },
      {
        key: "prompt_pages",
        label: "Prompt Pages",
        type: "html_string_array",
        default: [],
      },
      {
        key: "survey_json",
        label: "Survey Json",
        type: "object",
        default: null,
      },
    ]);

    expect(
      mapMetadataToData({
        response: { type: "string" },
        percent_in_roi: { type: "number_array" },
        source_video: { type: "video_array" },
      }),
    ).toEqual([
      { key: "response", label: "Response", type: "string" },
      {
        key: "percent_in_roi",
        label: "Percent In Roi",
        type: "number_array",
      },
      { key: "source_video", label: "Source Video", type: "string_array" },
    ]);
  });

  it("fetches plugin metadata and returns mapped parameters plus data fields", async () => {
    const fetchMock = vi.fn(async () =>
      createResponse({
        parameters: {
          stimulus: { type: "html_string", default: "<p>Hello</p>" },
          choices: { type: "string_array", default: ["yes", "no"] },
        },
        data: {
          rt: { type: "number" },
          response: { type: "string" },
        },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      loadPluginParameters("plugin-html-button-response"),
    ).resolves.toEqual({
      parameters: [
        {
          key: "stimulus",
          label: "Stimulus",
          type: "html_string",
          default: "<p>Hello</p>",
        },
        {
          key: "choices",
          label: "Choices",
          type: "string_array",
          default: ["yes", "no"],
        },
      ],
      data: [
        { key: "rt", label: "Rt", type: "number" },
        { key: "response", label: "Response", type: "string" },
      ],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/metadata/plugin-html-button-response.json",
    );
  });

  it("handles metadata without data as an empty data definition list", async () => {
    globalThis.fetch = vi.fn(async () =>
      createResponse({
        parameters: {
          stimulus: { type: "html_string" },
        },
      }),
    ) as unknown as typeof fetch;

    await expect(loadPluginParameters("plugin-cloze")).resolves.toEqual({
      parameters: [
        {
          key: "stimulus",
          label: "Stimulus",
          type: "html_string",
          default: null,
        },
      ],
      data: [],
    });
  });

  it("throws explicit loader errors for missing metadata or malformed metadata", async () => {
    globalThis.fetch = vi.fn(async () =>
      createResponse({}, false),
    ) as unknown as typeof fetch;

    await expect(loadPluginParameters("missing-plugin")).rejects.toThrow(
      "Metadata not found",
    );

    globalThis.fetch = vi.fn(async () =>
      createResponse({ data: { rt: { type: "number" } } }),
    ) as unknown as typeof fetch;

    await expect(loadPluginParameters("plugin-empty")).rejects.toThrow(
      "No parameters found for plugin: plugin-empty",
    );
  });

  it("exposes loading, parameters and data through usePluginParameters", async () => {
    globalThis.fetch = vi.fn(async () =>
      createResponse({
        parameters: {
          stimulus: { type: "html_string", default: "" },
        },
        data: {
          response: { type: "string" },
        },
      }),
    ) as unknown as typeof fetch;

    const { result } = renderHook(() => usePluginParameters("plugin-test"));

    expect(result.current).toEqual({
      parameters: [],
      data: [],
      loading: true,
      error: null,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.parameters).toEqual([
      {
        key: "stimulus",
        label: "Stimulus",
        type: "html_string",
        default: "",
      },
    ]);
    expect(result.current.data).toEqual([
      { key: "response", label: "Response", type: "string" },
    ]);
    expect(result.current.error).toBeNull();
  });

  it("exposes loader errors through usePluginParameters", async () => {
    globalThis.fetch = vi.fn(async () =>
      createResponse({}, false),
    ) as unknown as typeof fetch;

    const { result } = renderHook(() => usePluginParameters("plugin-missing"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.parameters).toEqual([]);
    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBe("Metadata not found");
  });

  it("ignores stale metadata responses after pluginName changes", async () => {
    const slowResponse = createDeferred<Response>();
    const fastResponse = createDeferred<Response>();
    globalThis.fetch = vi.fn((url: string) => {
      if (url.includes("plugin-slow")) return slowResponse.promise;
      return fastResponse.promise;
    }) as unknown as typeof fetch;

    const { result, rerender } = renderHook(
      ({ pluginName }) => usePluginParameters(pluginName),
      { initialProps: { pluginName: "plugin-slow" } },
    );

    rerender({ pluginName: "plugin-fast" });

    await act(async () => {
      fastResponse.resolve(
        createResponse({
          parameters: {
            fast_param: { type: "string", default: "fast" },
          },
          data: {
            fast_data: { type: "number" },
          },
        }),
      );
      await fastResponse.promise;
    });

    await waitFor(() => {
      expect(result.current.parameters).toEqual([
        {
          key: "fast_param",
          label: "Fast Param",
          type: "string",
          default: "fast",
        },
      ]);
    });

    await act(async () => {
      slowResponse.resolve(
        createResponse({
          parameters: {
            slow_param: { type: "string", default: "slow" },
          },
          data: {
            slow_data: { type: "number" },
          },
        }),
      );
      await slowResponse.promise;
    });

    expect(result.current.parameters).toEqual([
      {
        key: "fast_param",
        label: "Fast Param",
        type: "string",
        default: "fast",
      },
    ]);
    expect(result.current.data).toEqual([
      { key: "fast_data", label: "Fast Data", type: "number" },
    ]);
  });
});
