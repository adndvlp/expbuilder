import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import React from "react";
import TrialsContext from "../../pages/ExperimentBuilder/contexts/TrialsContext";
import useTrials from "../../pages/ExperimentBuilder/hooks/useTrials";

describe("useTrials", () => {
  const mockContextValue = {
    timeline: [
      { id: 1, type: "trial" as const, name: "Trial 1", branches: [] },
      { id: 2, type: "trial" as const, name: "Trial 2", branches: [] },
    ],
    loopTimeline: [],
    activeLoopId: null,
    selectedTrial: null,
    setSelectedTrial: vi.fn(),
    selectedLoop: null,
    setSelectedLoop: vi.fn(),
    createTrial: vi.fn(),
    getTrial: vi.fn(),
    updateTrial: vi.fn(),
    updateTrialField: vi.fn(),
    deleteTrial: vi.fn(),
    createLoop: vi.fn(),
    getLoop: vi.fn(),
    updateLoop: vi.fn(),
    updateLoopField: vi.fn(),
    deleteLoop: vi.fn(),
    updateTimeline: vi.fn(),
    getTimeline: vi.fn(),
    getLoopTimeline: vi.fn(),
    clearLoopTimeline: vi.fn(),
    deleteAllTrials: vi.fn(),
    isLoading: false,
  };

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(TrialsContext.Provider, { value: mockContextValue }, children);

  it("returns timeline from context", () => {
    const { result } = renderHook(() => useTrials(), { wrapper });
    expect(result.current.timeline).toHaveLength(2);
    expect(result.current.timeline[0].name).toBe("Trial 1");
  });

  it("returns default context when no provider", () => {
    const { result } = renderHook(() => useTrials());
    expect(result.current.timeline).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(typeof result.current.createTrial).toBe("function");
  });

  it("exposes CRUD methods", () => {
    const { result } = renderHook(() => useTrials(), { wrapper });
    expect(typeof result.current.createTrial).toBe("function");
    expect(typeof result.current.deleteTrial).toBe("function");
    expect(typeof result.current.updateTrial).toBe("function");
    expect(typeof result.current.createLoop).toBe("function");
    expect(typeof result.current.deleteLoop).toBe("function");
  });

  it("exposes selection state", () => {
    const { result } = renderHook(() => useTrials(), { wrapper });
    expect(result.current.selectedTrial).toBeNull();
    expect(result.current.selectedLoop).toBeNull();
    expect(typeof result.current.setSelectedTrial).toBe("function");
    expect(typeof result.current.setSelectedLoop).toBe("function");
  });
});
