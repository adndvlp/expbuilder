export type ParamDef = {
  key: string;
  description: string;
  type: "function" | "value";
  builderUsed?: { local?: boolean; public?: boolean };
};

export type Variant = "local" | "public";

export const JSPSYCH_PARAMS: ParamDef[] = [
  {
    key: "on_finish",
    description: "Function executed when experiment ends.",
    type: "function",
    builderUsed: { local: true, public: true },
  },
  {
    key: "on_data_update",
    description: "Function executed every time trial data is stored.",
    type: "function",
    builderUsed: { local: true, public: true },
  },
  {
    key: "on_trial_start",
    description: "Function executed when a new trial begins.",
    type: "function",
    builderUsed: { public: true },
  },
  {
    key: "on_trial_finish",
    description: "Function executed when a trial ends.",
    type: "function",
  },
  {
    key: "on_interaction_data_update",
    description: "Function executed on blur/focus/fullscreen events.",
    type: "function",
  },
  {
    key: "on_close",
    description: "Function executed when user leaves page.",
    type: "function",
  },
  {
    key: "display_element",
    description: "ID of HTML element to display experiment in.",
    type: "value",
  },
  {
    key: "message_progress_bar",
    description: "Message next to progress bar (string or function).",
    type: "value",
  },
  {
    key: "auto_update_progress_bar",
    description: "Boolean — auto-update progress bar per top-level trial.",
    type: "value",
  },
  {
    key: "use_webaudio",
    description: "Boolean — use WebAudio API for audio (default: true).",
    type: "value",
  },
  {
    key: "default_iti",
    description: "Default inter-trial interval in ms (default: 0).",
    type: "value",
  },
  {
    key: "experiment_width",
    description: "Width of jsPsych container in pixels.",
    type: "value",
  },
  {
    key: "minimum_valid_rt",
    description: "Minimum valid keyboard response time in ms.",
    type: "value",
  },
  {
    key: "override_safe_mode",
    description: "Boolean — override file:// protocol safe mode.",
    type: "value",
  },
  {
    key: "case_sensitive_responses",
    description:
      "Boolean — treat uppercase/lowercase keyboard responses differently.",
    type: "value",
  },
];

export function isBuilderUsed(param: ParamDef, variant: Variant): boolean {
  return !!param.builderUsed?.[variant];
}
