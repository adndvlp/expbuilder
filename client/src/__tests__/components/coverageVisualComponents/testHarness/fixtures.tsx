import "./mockState";
import "./reactKonvaMock";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { imageMockState, konvaMockState } from "./mockState";

beforeEach(() => {
  vi.clearAllMocks();
  imageMockState.loaded = true;
  konvaMockState.nullRefNames.clear();
  konvaMockState.activeAnchor = "middle-right";
  konvaMockState.scaleX = 1.4;
  konvaMockState.scaleY = 1.3;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
  } as any);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

export * from "./componentCases";
export {
  act,
  describe,
  expect,
  fireEvent,
  imageMockState,
  it,
  konvaMockState,
  render,
  screen,
  vi,
  waitFor,
};
