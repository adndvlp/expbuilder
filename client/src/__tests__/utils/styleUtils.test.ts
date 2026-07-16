import { describe, it, expect, vi } from "vitest";
import {
  getIsDarkMode,
  getCanvasBackground,
  getPatternStyle,
  getFabStyle,
} from "../../pages/ExperimentBuilder/components/Canvas/utils/styleUtils";

describe("getIsDarkMode", () => {
  it("returns undefined when matchMedia not available", () => {
    const original = window.matchMedia;
    // @ts-expect-error Exercising the runtime fallback where matchMedia is absent.
    delete window.matchMedia;
    // When matchMedia is missing, getIsDarkMode returns undefined (falsy)
    expect(getIsDarkMode()).toBeUndefined();
    window.matchMedia = original;
  });

  it("returns true when dark mode preferred", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-color-scheme: dark)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    expect(getIsDarkMode()).toBe(true);
  });

  it("returns false when light mode preferred", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    expect(getIsDarkMode()).toBe(false);
  });
});

describe("getCanvasBackground", () => {
  it("returns dark background style", () => {
    const style = getCanvasBackground(true);
    expect(style.background).toContain("#23272f");
    expect(style.minHeight).toBe(0);
    expect(style.height).toBe("100%");
    expect(style.overflow).toBe("hidden");
    expect(style.position).toBe("relative");
  });

  it("returns light background style", () => {
    const style = getCanvasBackground(false);
    expect(style.background).toContain("#f7f8fa");
    expect(style.minHeight).toBe(0);
    expect(style.height).toBe("100%");
  });
});

describe("getPatternStyle", () => {
  it("returns dark pattern style", () => {
    const style = getPatternStyle(true);
    expect(style.backgroundImage).toContain("#3a3f4b");
    expect(style.backgroundSize).toBe("28px 28px");
    expect(style.pointerEvents).toBe("none");
  });

  it("returns light pattern style", () => {
    const style = getPatternStyle(false);
    expect(style.backgroundImage).toContain("#dbe2ea");
  });
});

describe("getFabStyle", () => {
  it("returns dark fab style", () => {
    const style = getFabStyle(true);
    expect(style.background).toBe("#ffb300");
    expect(style.position).toBe("fixed");
    expect(style.bottom).toBe("32px");
    expect(style.right).toBe("32px");
    expect(style.borderRadius).toBe("50%");
    expect(style.width).toBe("56px");
    expect(style.height).toBe("56px");
  });

  it("returns light fab style", () => {
    const style = getFabStyle(false);
    expect(style.background).toBe("#1976d2");
    expect(style.color).toBe("#fff");
  });
});
