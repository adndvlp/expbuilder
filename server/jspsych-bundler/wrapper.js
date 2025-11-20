// Este archivo envuelve todas las exportaciones y las expone globalmente
import * as jsPsychModule from "./main.js";

// Exponer todo en el scope global
if (typeof window !== "undefined") {
  // Exponer todas las exportaciones directamente en window
  Object.assign(window, jsPsychModule);

  // También mantener una referencia al módulo completo
  window.jsPsychModule = jsPsychModule;
}

export * from "./main.js";
