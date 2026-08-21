import { JSPSYCH_PLUGIN_DECLARATIONS } from "./monacoJsPsychPluginDeclarations";

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
${JSPSYCH_PLUGIN_DECLARATIONS}

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
  [key: string]: any;
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
    JSPSYCH_BUILDER_CONTEXT,
    "ts:jspsych-builder-context.d.ts",
  );

  registeredMonacoInstances.add(monaco);
}
