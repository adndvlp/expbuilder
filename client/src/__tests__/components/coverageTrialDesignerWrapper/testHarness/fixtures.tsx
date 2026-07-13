import "./coreMocks";
import "./sidebarMock";
import "./canvasMocks";
import "./controlsMocks";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TrialDesigner from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner";
import { wrapperMocks } from "./state";

beforeEach(() => {
  vi.clearAllMocks();
  wrapperMocks.initialComponents = undefined;
  wrapperMocks.initialSelectedId = undefined;
});

export {
  TrialDesigner,
  act,
  describe,
  expect,
  fireEvent,
  it,
  render,
  screen,
  vi,
  waitFor,
  wrapperMocks,
};
