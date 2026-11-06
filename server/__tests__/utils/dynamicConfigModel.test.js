import { expect, test } from "@jest/globals";
import {
  normalizeDynamicTrial,
  normalizeDynamicDatabase,
  normalizeImportedExperiment,
} from "../../utils/dynamicConfigModel.js";

const typed = value => ({ source: "typed", value });
const visible = { trial_duration: typed(100), response_ends_trial: typed(true) };
const internal = { ...visible, __internalProbe: typed({ width: 800, height: 600 }) };
const components = [{
  type: "TextComponent", coordinates: { x: 12, y: -20 }, width: 30, height: 5,
  _font_size_runtime_vw: typed(2), text: typed("Keep __literal text"),
  survey_json: typed({ elements: [{ name: "__answer" }] }),
}];
const makeTrial = plugin => ({
  id: 1, plugin, columnMapping: { ...internal, components: typed(components) },
  paramsOverride: [{ id: 1, rules: [], paramsToOverride: internal }],
  branchConditions: [{ id: 2, rules: [], nextTrialId: 1, customParameters: internal }],
  csvJson: [{ __participant: "P1" }], customOnStart: "trial.__custom = true;",
  createdAt: "created", updatedAt: "updated",
});

test.each(["plugin-dynamic", "DynamicPlugin"])(
  "cleans parameter maps of %s without touching payloads or mutating the input",
  plugin => {
    const input = makeTrial(plugin);
    const original = structuredClone(input);
    const result = normalizeDynamicTrial(input);
    expect(result).toEqual({
      ...input,
      columnMapping: { ...visible, components: typed(components) },
      paramsOverride: [{ ...input.paramsOverride[0], paramsToOverride: visible }],
      branchConditions: [{ ...input.branchConditions[0], customParameters: visible }],
    });
    expect(input).toEqual(original);
    expect(normalizeDynamicTrial(result)).toEqual(result);
  },
);

test("preserves all declared public parameters, including timing and rendering options", () => {
  const names = [
    "components", "response_components", "require_response_components", "trial_duration",
    "response_ends_trial", "dynamic_csv_diagnostics", "preload_assets", "asset_preload_timeout",
    "record_frame_timing", "frame_lag_threshold", "prefetch_next_trials", "prefetch_trial_count",
    "timing_quality_bad_threshold", "render_backend", "record_render_timing", "diagnostics_level",
    "record_gpu_timing", "response_timing_enabled", "response_required", "response_allowed_from",
    "premature_response_policy", "response_timing_quality_mode", "minimum_valid_rt_ms",
    "response_calibration_profile", "response_expected_delay_ms", "external_reference_id",
  ];
  const mapping = Object.fromEntries(names.map(name => [name, typed(name)]));
  const result = normalizeDynamicTrial({ plugin: "plugin-dynamic", columnMapping: mapping });
  expect(result.columnMapping).toEqual(mapping);
});

test.each(["custom-plugin", undefined])("preserves the configuration of plugin %s", plugin => {
  const input = makeTrial(plugin);
  expect(normalizeDynamicTrial(input)).toEqual(input);
});

test.each([undefined, null, [], 42, "invalid"])("does not silently coerce a malformed mapping: %p", mapping => {
  const input = { plugin: "plugin-dynamic", columnMapping: mapping };
  expect(normalizeDynamicTrial(input)).toEqual(input);
});

test("normalization does not add missing optional maps or change condition structure", () => {
  const input = { plugin: "plugin-dynamic", branchConditions: [null, [], { rules: [] }] };
  expect(normalizeDynamicTrial(input)).toEqual(input);
  expect(normalizeDynamicTrial({ plugin: "plugin-dynamic" })).toEqual({ plugin: "plugin-dynamic" });
});

// TEMPORARY migration coverage; remove with its function: docs/temporary-migrations.md.
test("database cleanup invalidates only affected automatic programs and preserves other records", () => {
  const dirty = makeTrial("plugin-dynamic");
  const clean = normalizeDynamicTrial(dirty);
  const database = {
    trials: [
      { experimentID: "auto", trials: [dirty], loops: [], updatedAt: "keep" },
      { experimentID: "manual", trials: [dirty], loops: [] },
      { experimentID: "clean", trials: [clean], loops: [] },
      { experimentID: "custom", trials: [makeTrial("custom-plugin")], loops: [] },
    ],
    configs: ["auto", "manual", "clean", "custom"].map(experimentID => ({
      experimentID, isDevMode: experimentID === "manual", isSaveMode: true,
      data: { generatedCode: `${experimentID}();`, customCode: "keep();" },
    })),
    sessionResults: [{ response: 42 }], participantFiles: [{ name: "keep.png" }],
  };
  const original = structuredClone(database);
  const result = normalizeDynamicDatabase(database);
  expect(result.trials).toEqual([
    { ...database.trials[0], trials: [clean] },
    { ...database.trials[1], trials: [clean] },
    database.trials[2], database.trials[3],
  ]);
  expect(result.configs).toEqual([
    { ...database.configs[0], data: { ...database.configs[0].data, generatedCode: "" } },
    ...database.configs.slice(1),
  ]);
  expect(result.sessionResults).toEqual(database.sessionResults);
  expect(result.participantFiles).toEqual(database.participantFiles);
  expect(database).toEqual(original);
  expect(normalizeDynamicDatabase(result)).toEqual(result);
});

test.each([false, true])("import preserves manual=%s programs and other configuration fields", manual => {
  const input = {
    trials: { experimentID: "E1", trials: [makeTrial("plugin-dynamic")] },
    config: { experimentID: "E1", isDevMode: manual, isSaveMode: true, data: {
      generatedCode: "saved();", customCode: "keep();", customPreInitCode: { local: "init();" },
    } },
    sessionResults: [{ rt: 25 }],
  };
  const original = structuredClone(input);
  const result = normalizeImportedExperiment(input);
  expect(result.trials.trials[0]).toEqual(normalizeDynamicTrial(input.trials.trials[0]));
  expect(result.config).toEqual({ ...input.config, data: {
    ...input.config.data, generatedCode: manual ? "saved();" : "",
  } });
  expect(result.sessionResults).toEqual(input.sessionResults);
  expect(input).toEqual(original);
  expect(normalizeImportedExperiment(result)).toEqual(result);
});

test("import invalidates derived automatic code even when its trial model is already current", () => {
  const input = { config: { isDevMode: false, data: { generatedCode: "stale();" } } };
  expect(normalizeImportedExperiment(input)).toEqual({ config: { isDevMode: false, data: { generatedCode: "" } } });
});

test("missing configuration and generated code remain absent", () => {
  const input = { config: { experimentID: "E1", data: { customCode: "keep();" } } };
  expect(normalizeImportedExperiment(input)).toEqual(input);
  expect(normalizeDynamicDatabase({ experiments: [] })).toEqual({ experiments: [] });
});
