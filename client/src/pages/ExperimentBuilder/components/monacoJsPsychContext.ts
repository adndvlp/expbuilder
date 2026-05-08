import * as monaco from "monaco-editor";

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

// ─── Local config scope ───────────────────────────────────────────────────────
declare const pendingDataSaves: Promise<any>[];
declare let trialSessionId: string;
declare let socket: { emit(event: string, data?: any): void } | null;

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
  JSPSYCH_SESSION_ID?: string;
  JSPSYCH_FILE_UPLOAD_ENDPOINT?: string;
  JSPSYCH_EXPERIMENT_ID?: string;
  _socketReady?: boolean;
}

// ─── Builder UI helpers ───────────────────────────────────────────────────────
declare function _showLoading(message?: string): void;
declare function _hideLoading(): void;
declare function _setLoadingMsg(message: string): void;
declare function _showSuccess(): void;

// ─── Local HTML outer-scope (before async IIFE, accessible at injection point) ─
declare let isResuming: boolean;
declare let participantNumber: number;
declare const metadata: {
  browser: string;
  browserVersion: string;
  os: string;
  screenWidth: number;
  screenHeight: number;
  screenResolution: string;
  viewportWidth: number;
  viewportHeight: number;
  language: string;
  userAgent: string;
  startedAt: string;
};
declare function waitForSocket(): Promise<void>;
declare function saveSession(sessionId: string): Promise<number>;
declare function _generateSessionName(participantNumber: number | null): string | null;
declare function _sessionNameHasDynamic(): boolean;
declare function _renameSessionIfNeeded(oldId: string, newId: string): Promise<string>;
declare function _resolveResumeBranch(resumeRaw: string | null): string | null;

// ─── Local HTML async IIFE scope (declared before injection point) ────────────
declare const resumeRaw: string | null;
declare const existingJump: string | null;
declare const comingFromJumpReload: boolean;
declare function evaluateCondition(trialData: any, condition: any): boolean;
declare function getNextTrialId(lastTrialData: any): string | null;

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
  return "jsPsych" + name.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join("");
}

// Call whenever the plugin list changes. Replaces the same extra-lib filename,
// so Monaco picks up the new globals without duplicating declarations.
export function updateCustomPluginContext(monacoInst: typeof monaco, pluginNames: string[]): void {
  const decls = pluginNames.length
    ? pluginNames.map((n) => `declare const ${pluginNameToGlobal(n)}: any;`).join("\n")
    : "// no custom plugins loaded";

  monacoInst.languages.typescript.javascriptDefaults.addExtraLib(
    decls,
    "ts:jspsych-custom-plugins.d.ts",
  );
}

let _contextRegistered = false;

export function setupMonacoJsPsychContext(monacoInst: typeof monaco): void {
  if (_contextRegistered) return;
  _contextRegistered = true;

  monacoInst.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
  });

  monacoInst.languages.typescript.javascriptDefaults.setCompilerOptions({
    checkJs: true,
    allowJs: true,
    noEmit: true,
    strict: false,
    noImplicitAny: false,
    noUnusedLocals: false,
    noUnusedParameters: false,
    allowNonTsExtensions: true,
    target: monacoInst.languages.typescript.ScriptTarget.ESNext,
  });

  monacoInst.languages.typescript.javascriptDefaults.addExtraLib(
    JSPSYCH_BUILDER_CONTEXT,
    "ts:jspsych-builder-context.d.ts",
  );
}
