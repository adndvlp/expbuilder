import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import React from "react";
import DevModeContext from "../../pages/ExperimentBuilder/contexts/DevModeContext";
import type {
  CustomInitJsPsychParams,
  CustomPreInitCode,
} from "../../pages/ExperimentBuilder/contexts/DevModeContext";
import useDevMode from "../../pages/ExperimentBuilder/hooks/useDevMode";

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const value = {
    isDevMode: true,
    setDevMode: vi.fn(),
    isSaveMode: false,
    setSaveMode: vi.fn(),
    code: "console.log('test')",
    setCode: vi.fn(),
    customCode: "",
    setCustomCode: vi.fn(),
    customInitJsPsychParams: {
      local: {},
      public: {},
    } as CustomInitJsPsychParams,
    setCustomInitJsPsychParam: vi.fn(),
    customPreInitCode: { local: "", public: "" } as CustomPreInitCode,
    setCustomPreInitCode: vi.fn(),
  };

  return React.createElement(DevModeContext.Provider, { value }, children);
};

describe("useDevMode", () => {
  it("returns context values", () => {
    const { result } = renderHook(() => useDevMode(), { wrapper });
    expect(result.current.isDevMode).toBe(true);
    expect(result.current.isSaveMode).toBe(false);
    expect(result.current.code).toBe("console.log('test')");
  });

  it("throws error when used outside provider", () => {
    expect(() => renderHook(() => useDevMode())).toThrow(
      "useDevMode must be used within a DevModeProvider",
    );
  });

  it("provides setDevMode function", () => {
    const { result } = renderHook(() => useDevMode(), { wrapper });
    expect(typeof result.current.setDevMode).toBe("function");
  });

  it("provides setCustomInitJsPsychParam", () => {
    const { result } = renderHook(() => useDevMode(), { wrapper });
    expect(typeof result.current.setCustomInitJsPsychParam).toBe("function");
  });
});
