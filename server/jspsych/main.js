// Importar JsPsych principal
import { initJsPsych } from "jspsych";

// Importar todos los plugins descargados
import "@jspsych/plugin-animation";
import "@jspsych/plugin-audio-button-response";
import "@jspsych/plugin-audio-keyboard-response";
import "@jspsych/plugin-audio-slider-response";
import "@jspsych/plugin-browser-check";
import "@jspsych/plugin-call-function";
import "@jspsych/plugin-canvas-button-response";
import "@jspsych/plugin-canvas-keyboard-response";
import "@jspsych/plugin-canvas-slider-response";
import "@jspsych/plugin-categorize-animation";
import "@jspsych/plugin-categorize-html";
import "@jspsych/plugin-categorize-image";
import "@jspsych/plugin-cloze";
import "@jspsych/plugin-external-html";
import "@jspsych/plugin-free-sort";
import "@jspsych/plugin-fullscreen";
import "@jspsych/plugin-html-audio-response";
import "@jspsych/plugin-html-button-response";
import "@jspsych/plugin-html-keyboard-response";
import "@jspsych/plugin-html-slider-response";
import "@jspsych/plugin-html-video-response";
import "@jspsych/plugin-iat-html";
import "@jspsych/plugin-iat-image";
import "@jspsych/plugin-image-button-response";
import "@jspsych/plugin-image-keyboard-response";
import "@jspsych/plugin-image-slider-response";
import "@jspsych/plugin-initialize-camera";
import "@jspsych/plugin-initialize-microphone";
import "@jspsych/plugin-instructions";
import "@jspsych/plugin-maxdiff";
import "@jspsych/plugin-mirror-camera";
import "@jspsych/plugin-preload";
import "@jspsych/plugin-reconstruction";
import "@jspsych/plugin-resize";
import "@jspsych/plugin-same-different-html";
import "@jspsych/plugin-same-different-image";
import "@jspsych/plugin-serial-reaction-time";
import "@jspsych/plugin-serial-reaction-time-mouse";
import "@jspsych/plugin-sketchpad";
import "@jspsych/plugin-survey";
import "@jspsych/plugin-survey-html-form";
import "@jspsych/plugin-survey-likert";
import "@jspsych/plugin-survey-multi-choice";
import "@jspsych/plugin-survey-multi-select";
import "@jspsych/plugin-survey-text";
import "@jspsych/plugin-video-button-response";
import "@jspsych/plugin-video-keyboard-response";
import "@jspsych/plugin-video-slider-response";
import "@jspsych/plugin-virtual-chinrest";
import "@jspsych/plugin-visual-search-circle";
import "@jspsych/extension-webgazer";
import "@jspsych/plugin-webgazer-calibrate";
import "@jspsych/plugin-webgazer-init-camera";
import "@jspsych/plugin-webgazer-validate";
import "@jspsych/extension-record-video";
import "@jspsych/extension-mouse-tracking";

// Importar CSS de jspsych y survey
import "jspsych/css/jspsych.css";
import "@jspsych/plugin-survey/css/survey.css";

// Cargar e incluir el dynamic plugin
import "../dynamicplugin/dist/index.iife.js";

// Exponer todo globalmente para uso en el HTML
if (typeof window !== "undefined") {
  window.initJsPsych = initJsPsych;
  // DynamicPlugin se expone automáticamente desde su propio build IIFE
}
