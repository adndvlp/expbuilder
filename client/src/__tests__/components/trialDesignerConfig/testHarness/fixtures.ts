import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PREVIEW_VIEWPORT } from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";
import type {
  PreviewViewport,
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

const previewViewport: PreviewViewport = {
  ...DEFAULT_PREVIEW_VIEWPORT,
  width: 1000,
  height: 700,
};

function toJsPsychCoords(x: number, y: number) {
  return { x: x / 10, y: y / 10 };
}

function fromJsPsychCoords(coords: { x: number; y: number }) {
  return { x: coords.x * 10, y: coords.y * 10 };
}

export {
  DEFAULT_PREVIEW_VIEWPORT,
  React,
  applyComponentConfigPatch,
  previewViewport,
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
export type { PreviewViewport, TrialComponent };
