import { MONACO_LOCAL_PERSISTENCE_CONTEXT } from "./monacoLocalPersistenceContext";

// Full ambient context for all Monaco editors in the builder.
// Covers: local config, public config, jsPsych bundle globals, Firebase, URL params.
// Goal: prevent user code from redeclaring builder-owned consts/lets that exist in the HTML.
const JSPSYCH_BUILDER_CONTEXT = `
// ─── jsPsych core ────────────────────────────────────────────────────────────
declare function initJsPsych(settings?: {
  display_element?: string;
  show_progress_bar?: boolean;
  message_progress_bar?: string | (() => string);
  auto_update_progress_bar?: boolean;
  use_webaudio?: boolean;
  default_iti?: number;
  experiment_width?: number | null;
  minimum_valid_rt?: number;
  override_safe_mode?: boolean;
  case_sensitive_responses?: boolean;
  extensions?: any[];
  on_finish?: (data?: any) => any;
  on_trial_start?: (trial: any) => void;
  on_trial_finish?: (data: any) => void;
  on_data_update?: (data: any) => void;
  on_interaction_data_update?: (data: any) => void;
  on_close?: () => void;
  [key: string]: any;
}): typeof jsPsych;

declare const jsPsych: {
  run(timeline: any[]): Promise<void>;
  data: {
    get(): { values(): any[]; filter(filters: any): any; addProperties(props: any): void };
    write(data: any): void;
    addProperties(props: Record<string, any>): void;
  };
  finishTrial(data?: Record<string, any>): void;
  abortExperiment(message?: string, data?: any): void;
  pauseExperiment(): void;
  resumeExperiment(): void;
  getDisplayElement(): HTMLElement;
  pluginAPI: {
    setTimeout(fn: () => void, delay: number): number;
    clearAllTimeouts(): void;
    getAudioBuffer(src: string): Promise<AudioBuffer>;
    preloadAudio(files: string[]): Promise<void>;
    preloadImages(files: string[]): Promise<void>;
    [key: string]: any;
  };
  [key: string]: any;
};

declare const ParameterType: Record<string, any>;

// ─── jsPsych plugins (exposed on window via Object.assign(window, bundle)) ───
declare const jsPsychAnimation: any;
declare const jsPsychAudioButtonResponse: any;
declare const jsPsychAudioKeyboardResponse: any;
declare const jsPsychAudioSliderResponse: any;
declare const jsPsychBrowserCheck: any;
declare const jsPsychCallFunction: any;
declare const jsPsychCanvasButtonResponse: any;
declare const jsPsychCanvasKeyboardResponse: any;
declare const jsPsychCanvasSliderResponse: any;
declare const jsPsychCategorizeAnimation: any;
declare const jsPsychCategorizeHtml: any;
declare const jsPsychCategorizeImage: any;
declare const jsPsychCloze: any;
declare const jsPsychExtensionMouseTracking: any;
declare const jsPsychExtensionRecordVideo: any;
declare const jsPsychExtensionWebgazer: any;
declare const jsPsychExternalHtml: any;
declare const jsPsychFreeSort: any;
declare const jsPsychFullscreen: any;
declare const jsPsychHtmlAudioResponse: any;
declare const jsPsychHtmlButtonResponse: any;
declare const jsPsychHtmlKeyboardResponse: any;
declare const jsPsychHtmlSliderResponse: any;
declare const jsPsychHtmlVideoResponse: any;
declare const jsPsychIatHtml: any;
declare const jsPsychIatImage: any;
declare const jsPsychImageButtonResponse: any;
declare const jsPsychImageKeyboardResponse: any;
declare const jsPsychImageSliderResponse: any;
declare const jsPsychInitializeCamera: any;
declare const jsPsychInitializeMicrophone: any;
declare const jsPsychInstructions: any;
declare const jsPsychMaxdiff: any;
declare const jsPsychMirrorCamera: any;
declare const jsPsychModule: Record<string, any>;
declare const jsPsychPreload: any;
declare const jsPsychReconstruction: any;
declare const jsPsychResize: any;
declare const jsPsychSameDifferentHtml: any;
declare const jsPsychSameDifferentImage: any;
declare const jsPsychSerialReactionTime: any;
declare const jsPsychSerialReactionTimeMouse: any;
declare const jsPsychSketchpad: any;
declare const jsPsychSurvey: any;
declare const jsPsychSurveyHtmlForm: any;
declare const jsPsychSurveyLikert: any;
declare const jsPsychSurveyMultiChoice: any;
declare const jsPsychSurveyMultiSelect: any;
declare const jsPsychSurveyText: any;
declare const jsPsychVideoButtonResponse: any;
declare const jsPsychVideoKeyboardResponse: any;
declare const jsPsychVideoSliderResponse: any;
declare const jsPsychVirtualChinrest: any;
declare const jsPsychVisualSearchCircle: any;
declare const jsPsychWebgazerCalibrate: any;
declare const jsPsychWebgazerInitCamera: any;
declare const jsPsychWebgazerValidate: any;

// ─── DynamicPlugin (dynamicplugin/dist/index.iife.js) ────────────────────────
declare const DynamicPlugin: any;

// ─── on_data_update / on_finish callback param ───────────────────────────────
declare const data: {
  rt: number | null;
  response: any;
  trial_index: number;
  trial_type: string;
  time_elapsed: number;
  builder_id?: string | null;
  branches?: (string | number)[];
  branchConditions?: any[];
  clientTimestamp?: number;
  sessionId?: string;
  experimentID?: string;
  [key: string]: any;
};

// ─── on_start / on_trial_start callback param ────────────────────────────────
declare const trial: {
  type: any;
  data?: Record<string, any>;
  prev_response?: any;
  [key: string]: any;
};

// ─── Public config scope ──────────────────────────────────────────────────────
declare const sessionRef: {
  update(data: any): Promise<void>;
  onDisconnect(): { cancel(): void; update(data: any): void };
};
declare const BATCH_CONFIG: {
  size: number;
  currentBatchNumber: number;
  resumeTimeoutMinutes: number;
  useIndexedDB: boolean;
};
declare const TrialDB: {
  add(trial: any): Promise<any>;
  getAll(): Promise<any[]>;
  count(): Promise<number>;
  getN(n: number): Promise<any[]>;
  deleteN(n: number): Promise<number>;
  clear(): Promise<void>;
};
declare const pendingBatchSaves: Promise<any>[];
declare function sendBatchConcatenated(trials: any[], batchNumber: number): Promise<void>;
declare function sendCompleteExperiment(trials: any[]): Promise<void>;

// ─── Firebase (public config) ─────────────────────────────────────────────────
declare const firebase: {
  database: {
    ServerValue: { TIMESTAMP: any; [key: string]: any };
    [key: string]: any;
  };
  auth(): any;
  firestore(): any;
  storage(): any;
  [key: string]: any;
};

// ─── URL / recruitment params (public config) ─────────────────────────────────
declare const _urlParams: URLSearchParams;
declare const _prolificPID: string | null;
declare const _mturkWorkerID: string | null;

// ─── Builder window globals — augment global Window interface ─────────────────
interface Window {
  nextTrialId?: string | null;
  skipRemaining?: boolean;
  branchingActive?: boolean;
  branchCustomParameters?: Record<string, any> | null;
  _socketReady?: boolean;
  [key: string]: any;
}

// ─── Socket.IO client global ──────────────────────────────────────────────────
declare function io(url?: string, opts?: Record<string, any>): {
  emit(event: string, data?: any): void;
  on(event: string, fn: (...args: any[]) => void): void;
  off(event: string, fn?: (...args: any[]) => void): void;
  disconnect(): void;
  [key: string]: any;
};
`;

function pluginNameToGlobal(name: string): string {
  return (
    "jsPsych" +
    name
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join("")
  );
}

type JavaScriptDefaults = {
  addExtraLib: (content: string, filePath?: string) => unknown;
  setCompilerOptions: (options: Record<string, unknown>) => void;
  setDiagnosticsOptions: (options: Record<string, unknown>) => void;
};

type MonacoWithTypeScript = {
  languages?: {
    typescript?: {
      javascriptDefaults?: JavaScriptDefaults;
      ScriptTarget?: {
        ESNext?: unknown;
      };
    };
  };
};

function getMonacoWithTypeScript(value: unknown): MonacoWithTypeScript | null {
  if (
    (typeof value !== "object" || value === null) &&
    typeof value !== "function"
  ) {
    return null;
  }

  return value as MonacoWithTypeScript;
}

// Call whenever the plugin list changes. Replaces the same extra-lib filename,
// so Monaco picks up the new globals without duplicating declarations.
export function updateCustomPluginContext(
  monacoInst: unknown,
  pluginNames: string[],
): void {
  const monaco = getMonacoWithTypeScript(monacoInst);
  const javascriptDefaults = monaco?.languages?.typescript?.javascriptDefaults;
  if (!javascriptDefaults) return;

  const decls = pluginNames.length
    ? pluginNames
        .map((n) => `declare const ${pluginNameToGlobal(n)}: any;`)
        .join("\n")
    : "// no custom plugins loaded";

  javascriptDefaults.addExtraLib(decls, "ts:jspsych-custom-plugins.d.ts");
}

const registeredMonacoInstances = new WeakSet<object>();

export function setupMonacoJsPsychContext(monacoInst: unknown): void {
  const monaco = getMonacoWithTypeScript(monacoInst);
  if (!monaco || registeredMonacoInstances.has(monaco)) {
    return;
  }

  const typescript = monaco.languages?.typescript;
  const javascriptDefaults = typescript?.javascriptDefaults;
  if (!javascriptDefaults || typescript.ScriptTarget?.ESNext === undefined) {
    return;
  }

  javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
  });

  javascriptDefaults.setCompilerOptions({
    checkJs: true,
    allowJs: true,
    noEmit: true,
    strict: false,
    noImplicitAny: false,
    noUnusedLocals: false,
    noUnusedParameters: false,
    allowNonTsExtensions: true,
    target: typescript.ScriptTarget.ESNext,
  });

  javascriptDefaults.addExtraLib(
    JSPSYCH_BUILDER_CONTEXT + MONACO_LOCAL_PERSISTENCE_CONTEXT,
    "ts:jspsych-builder-context.d.ts",
  );

  registeredMonacoInstances.add(monaco);
}
