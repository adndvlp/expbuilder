import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useComponentMetadata } from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/hooks/useComponentMetadata";
import ComponentSidebar from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/ComponentSidebar";
import ComponentsSection from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/ComponentSidebar/ComponentsSection";
import LeftSideBar from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/ComponentSidebar/LeftSideBar";
import ResponseComponetsSection from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/ComponentSidebar/ResponseComponetsSection";
import type {
  ComponentType,
  TrialComponent,
} from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";

const API_URL = "http://localhost:3000";

function okJson(payload: unknown, ok = true): Response {
  return {
    ok,
    json: vi.fn(async () => payload),
  } as unknown as Response;
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function fetchMock() {
  return vi.mocked(globalThis.fetch);
}

const defaultSidebarProps = {
  selectedId: null,
  selectedIds: [],
  isResizingLeft: { current: false },
  leftPanelWidth: 280,
  setShowLeftPanel: vi.fn(),
  setLeftPanelWidth: vi.fn(),
  setSelectedIds: vi.fn(),
  CANVAS_WIDTH: 1000,
  CANVAS_HEIGHT: 600,
  toJsPsychCoords: vi.fn(() => ({ x: 12, y: -5 })),
  images: [],
  audios: [],
  videos: [],
  getDefaultConfig: vi.fn((type: ComponentType) => ({
    label: { source: "typed", value: type },
  })),
};

export {
  API_URL,
  ComponentSidebar,
  ComponentsSection,
  LeftSideBar,
  React,
  ResponseComponetsSection,
  act,
  afterEach,
  beforeEach,
  createDeferred,
  defaultSidebarProps,
  describe,
  expect,
  fetchMock,
  fireEvent,
  it,
  okJson,
  render,
  renderHook,
  screen,
  useComponentMetadata,
  useState,
  vi,
  waitFor,
};
export type { ComponentType, TrialComponent };
