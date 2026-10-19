import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { vi } from "vitest";
import { resumeCode } from "../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/ResumeCode";
import { generateOnFinishCode } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialCode/TrialCodeGenerators/onFinishGenerator";
import { toCodeIdentifier } from "../../pages/ExperimentBuilder/utils/codegen/codeIdentifier";
import type { ExecutionAddressManifest } from "../../pages/ExperimentBuilder/modules/experiment-runtime/executionAddressManifest";

type Row = Record<string, unknown>;
type Node = Row & { timeline?: Node[] };
type Instance = {
  run(timeline: Node[]): Promise<void>;
  finishTrial(data: Row): void;
  abortTimelineByName(name: string): void;
  data: { get(): { values(): Row[] } };
};
type Navigation = {
  attach(instance: Instance, timeline: Node[]): void;
  registerTrial(id: string | number, node: Node): void;
  activateResume(decision: Row): boolean;
  onTrialPersisted(data: Row): void;
  takeParameters(id: string | number): Row | null;
  checkpointTrialStart(data: Row): void;
  checkpointTrialComplete(data: Row, fallback: Row): Row;
};

const bundle = readFileSync(
  resolve("../server/jspsych-bundle/index.js"),
  "utf8",
);

export function scopeManifest(
  scopes: Record<string, (string | number)[]>,
): ExecutionAddressManifest {
  const manifest: ExecutionAddressManifest = {
    version: 3,
    revision: "fixture-r1",
    nextBySource: {},
    entries: Object.fromEntries(Object.entries(scopes).map(([id, items]) => [id, items[0] == null ? null : String(items[0])])),
    loopContinuations: {},
    scopes: {},
    allScopes: {},
    addressesByTarget: {},
  };
  for (const [id, items] of Object.entries(scopes)) {
    manifest.scopes[id] = items.map(String);
    manifest.allScopes[id] = items.map(String);
  }
  function visit(scope: string, path: string[]) {
    for (const id of scopes[scope]) {
      const key = String(id);
      const loop = Object.hasOwn(scopes, key);
      manifest.addressesByTarget[key] = {
        targetId: id,
        targetKind: loop ? "loop" : "trial",
        targetOwnerId: scope === "root" ? null : scope,
        enterLoopIds: [...path],
      };
      if (loop) visit(key, [...path, key]);
    }
  }
  visit("root", []);
  return manifest;
}

export function nativeTrial(
  id: string | number,
  name: string,
  options: Omit<Parameters<typeof generateOnFinishCode>[0], "getVarName"> = {},
) {
  const variable = `${toCodeIdentifier(name)}_timeline`;
  return {
    id,
    trialName: name,
    pluginName: "html-keyboard-response",
    timelineProps: `const ${variable} = {
      type: AutoTrial, save_timeline_variables: true, data: { builder_id: ${JSON.stringify(id)} },
      ${generateOnFinishCode({ defaultNextTrialId: options.branches?.[0] ?? null, ...options, getVarName: (name) => name })}
    }; window.ExpBuilderNavigation.registerTrial(${JSON.stringify(id)}, ${variable});`,
  };
}

export function nativeTimelineRuntime(
  code: string,
  manifest: ExecutionAddressManifest,
  options: {
    resume?: Row;
    response?: string;
    onTrial?: (data: Row, nav: Navigation) => void;
  } = {},
) {
  const initialize = new Function(
    "window",
    "document",
    `${bundle}; return window.initJsPsych;`,
  )(window, document);
  const storage = new Map<string, string>();
  const store = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
  };
  const runtimeWindow = {
    ExpBuilderExecutionAddresses: manifest,
    ExpBuilderNavigation: undefined as unknown as Navigation,
    ExpBuilderPersistence: undefined as unknown as { start(): object; finish(token: object): void },
    ExpBuilderRuntime: { emit: vi.fn(), reportError: vi.fn() },
    location: { reload: vi.fn() },
  };
  const element = document.createElement("div");
  document.body.append(element);
  const instance: Instance = initialize({
    display_element: element,
    use_webaudio: false,
    on_trial_start(trial: Node & { data?: { builder_id?: string | number } }) {
      if (trial.data?.builder_id != null)
        runtimeWindow.ExpBuilderNavigation.checkpointTrialStart(trial.data);
    },
    on_data_update(data: Row) {
      store.setItem("jsPsych_resumeTrial", JSON.stringify(checkpoint(data)));
      runtimeWindow.ExpBuilderNavigation.onTrialPersisted(data);
    },
  });
  class AutoTrial {
    static info = {
      name: "native-fixture",
      version: "1.0",
      parameters: {},
      data: {},
    };
    constructor(private jsPsych: Instance) {}
    trial(
      _display: HTMLElement,
      trial: Node & { data: { builder_id: string | number } },
    ) {
      const data = {
        builder_id: trial.data.builder_id,
        response: options.response ?? "go",
        parameters: runtimeWindow.ExpBuilderNavigation.takeParameters(
          trial.data.builder_id,
        ),
      };
      options.onTrial?.(data, runtimeWindow.ExpBuilderNavigation);
      this.jsPsych.finishTrial(data);
    }
  }
  const compiled = new Function(
    "window",
    "localStorage",
    "sessionStorage",
    "jsPsych",
    "AutoTrial",
    `
    const trialSessionId = 'fixture-session'; const participantNumber = 1;
    const timeline = [];
    ${resumeCode()}
    ${code}
    return { timeline, checkpoint: _createResumeCheckpoint, resolveCheckpoint: _resolveResumeBranch };
  `,
  )(runtimeWindow, store, store, instance, AutoTrial);
  const timeline: Node[] = compiled.timeline;
  const checkpoint: (data: Row) => unknown = compiled.checkpoint;
  const nav = runtimeWindow.ExpBuilderNavigation;
  if (options.resume) nav.activateResume(options.resume);
  return {
    window: runtimeWindow,
    nav,
    instance,
    timeline,
    storage,
    resolveCheckpoint: compiled.resolveCheckpoint as (raw: string) => Row | null,
    async run() {
      nav.attach(instance, timeline);
      try {
        await instance.run(timeline);
        return instance.data.get().values();
      } finally {
        element.remove();
      }
    },
  };
}
