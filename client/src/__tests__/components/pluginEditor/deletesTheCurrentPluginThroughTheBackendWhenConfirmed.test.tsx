import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PluginEditor from "../../../pages/ExperimentBuilder/components/PluginEditor";

const mocks = vi.hoisted(() => ({
  makePlugins: () => [
    {
      name: "starter",
      scripTag: "/plugins/starter.js",
      pluginCode: "class Starter {}",
      index: 0,
    },
    {
      name: "existing",
      scripTag: "/plugins/existing.js",
      pluginCode: "class Existing {}",
      index: 1,
    },
  ],
  plugins: [] as Array<{
    name: string;
    scripTag: string;
    pluginCode: string;
    index: number;
  }>,
  setPlugins: vi.fn(),
  selectedTrial: {
    id: 7,
    type: "Trial",
    name: "Trial 7",
    plugin: "starter",
    parameters: {},
    trialCode: "",
  } as Record<string, unknown>,
  updateTrial: vi.fn(
    async (_id: string | number, patch: Record<string, unknown>) => ({
      id: 7,
      name: "Trial 7",
      plugin: patch.plugin,
    }),
  ),
  setSelectedTrial: vi.fn(),
  mediaChangeHandler: undefined as
    | ((event: MediaQueryListEvent) => void)
    | undefined,
  mediaQuery: undefined as
    | {
        matches: boolean;
        addEventListener: ReturnType<typeof vi.fn>;
        removeEventListener: ReturnType<typeof vi.fn>;
      }
    | undefined,
}));

vi.mock("@monaco-editor/react", () => ({
  Editor: ({
    value,
    onChange,
    theme,
  }: {
    value: string;
    onChange: (value?: string) => void;
    theme: string;
  }) => (
    <textarea
      aria-label="Plugin code"
      data-theme={theme}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  default: ({
    value,
    onChange,
    theme,
  }: {
    value: string;
    onChange: (value?: string) => void;
    theme: string;
  }) => (
    <textarea
      aria-label="Plugin code"
      data-theme={theme}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock("../../../pages/ExperimentBuilder/hooks/usePlugins", () => ({
  default: () => ({
    plugins: mocks.plugins,
    setPlugins: mocks.setPlugins,
  }),
}));

vi.mock("../../../pages/ExperimentBuilder/hooks/useTrials", () => ({
  default: () => ({
    selectedTrial: mocks.selectedTrial,
    updateTrial: mocks.updateTrial,
    setSelectedTrial: mocks.setSelectedTrial,
  }),
}));

class FileReaderMock {
  onload: ((event: { target: { result: string } }) => void) | null = null;

  readAsText(file: File) {
    this.onload?.({
      target: { result: `// uploaded ${file.name}` },
    });
  }
}

const originalLocation = window.location;

describe("PluginEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.plugins = mocks.makePlugins();
    mocks.selectedTrial = {
      id: 7,
      type: "Trial",
      name: "Trial 7",
      plugin: "starter",
      parameters: {},
      trialCode: "",
    };
    mocks.updateTrial.mockImplementation(
      async (_id: string | number, patch: Record<string, unknown>) => ({
        id: 7,
        name: "Trial 7",
        plugin: patch.plugin,
      }),
    );
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("FileReader", FileReaderMock);
    mocks.mediaChangeHandler = undefined;
    mocks.mediaQuery = {
      matches: true,
      addEventListener: vi.fn(
        (_event: string, handler: (event: MediaQueryListEvent) => void) => {
          mocks.mediaChangeHandler = handler;
        },
      ),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => mocks.mediaQuery),
    });
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("deletes the current plugin through the backend when confirmed", async () => {
    vi.useFakeTimers();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { reload },
    });

    render(<PluginEditor selectedPluginName="starter" />);

    await act(async () => {
      fireEvent.click(screen.getByText("Delete Plugin"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/delete-plugin/0",
      { method: "DELETE" },
    );

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(reload).toHaveBeenCalled();
  });

  it("cancels deletion, handles delete failures, and applies inline interaction styles", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { reload },
    });

    render(<PluginEditor selectedPluginName="starter" />);

    const nameInput = screen.getByDisplayValue("starter");
    fireEvent.focus(nameInput);
    fireEvent.blur(nameInput);

    const deleteButton = screen.getByText("Delete Plugin");
    fireEvent.mouseOver(deleteButton);
    expect(deleteButton).toHaveStyle({
      boxShadow: "0 4px 12px rgba(211,47,47,0.25)",
    });
    fireEvent.mouseOut(deleteButton);
    expect(deleteButton).toHaveStyle({
      boxShadow: "0 2px 8px rgba(211,47,47,0.15)",
    });

    fireEvent.click(deleteButton);
    expect(globalThis.fetch).not.toHaveBeenCalled();

    confirm.mockReturnValueOnce(true);
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(
      new Error("delete failed"),
    );
    await act(async () => {
      fireEvent.click(deleteButton);
      await Promise.resolve();
    });

    expect(console.error).toHaveBeenCalledWith(
      "Error deleting plugin from backend",
      expect.any(Error),
    );
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(reload).toHaveBeenCalled();
  });
});
