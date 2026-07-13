import "./mocks";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import TrialsConfig from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration";
import type { Trial } from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/types";
import { mocks } from "./state";

function makeTrial(overrides: Partial<Trial> = {}): Trial {
  return {
    id: 10,
    type: "trial",
    name: "Target Trial",
    plugin: "plugin-html-keyboard-response",
    parameters: {
      includesExtensions: false,
      extensionType: "",
    },
    trialCode: "",
    columnMapping: {
      stimulus: { source: "typed", value: "<p>Old</p>" },
      choices: { source: "typed", value: ["y", "n"] },
    },
    ...overrides,
  };
}

function installTrialsContext(
  selectedTrial: Trial | null,
  overrides: Partial<any> = {},
) {
  mocks.trialsContext = {
    selectedTrial,
    setSelectedTrial: vi.fn(),
    updateTrial: vi.fn(async (id: string | number, data: unknown) => ({
      id,
      ...(data as object),
    })),
    updateTrialField: vi.fn(async () => true),
    getLoop: vi.fn(async () => ({
      id: "loop_1",
      name: "Parent Loop",
      csvColumns: ["stimulus_col", "choice_col"],
      csvJson: [{ stimulus_col: "A", choice_col: "y" }],
    })),
    deleteTrial: vi.fn(async () => true),
    timeline: [{ id: 10, name: "Target Trial" }],
    ...overrides,
  };
}

export {
  TrialsConfig,
  act,
  afterEach,
  beforeEach,
  describe,
  expect,
  fireEvent,
  installTrialsContext,
  it,
  makeTrial,
  mocks,
  render,
  screen,
  vi,
  waitFor,
};
export type { Trial };
