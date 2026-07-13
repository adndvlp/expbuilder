import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CANVAS_STYLES } from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";
import type {
  CanvasStyles,
  TrialComponent,
} from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";
import {
  applyComponentConfigPatch,
  typedValue,
} from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/componentConfigUpdates";
import {
  getComponentSnapBox,
  snapBoxToGuides,
  snapComponentBox,
} from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/editorGuides";
import useConfigComponents from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/useConfigFromComponents";
import useLoadComponents from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/useLoadComponents";
import {
  restoreStyleFields,
  syncConfigToComponent,
} from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/syncConfigToComponent";
import {
  getTextHeightForWidth,
  getTextNaturalSize,
} from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/textSizing";
import {
  getConfigValue,
  getTextComponentModel,
} from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/textComponentModel";

const canvasStyles: CanvasStyles = {
  ...DEFAULT_CANVAS_STYLES,
  width: 1000,
  height: 700,
  backgroundColor: "#101010",
  fullScreen: false,
};

function toJsPsychCoords(x: number, y: number) {
  return { x: x / 10, y: y / 10 };
}

function fromJsPsychCoords(coords: { x: number; y: number }) {
  return { x: coords.x * 10, y: coords.y * 10 };
}

export {
  DEFAULT_CANVAS_STYLES,
  React,
  applyComponentConfigPatch,
  canvasStyles,
  describe,
  expect,
  fromJsPsychCoords,
  getComponentSnapBox,
  getConfigValue,
  getTextComponentModel,
  getTextHeightForWidth,
  getTextNaturalSize,
  it,
  renderHook,
  restoreStyleFields,
  snapBoxToGuides,
  snapComponentBox,
  syncConfigToComponent,
  toJsPsychCoords,
  typedValue,
  useConfigComponents,
  useLoadComponents,
  vi,
  waitFor,
};
export type { CanvasStyles, TrialComponent };
