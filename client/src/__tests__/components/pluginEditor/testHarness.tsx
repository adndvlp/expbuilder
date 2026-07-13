import { afterEach, beforeEach, vi } from "vitest";
import type { ComponentProps } from "react";
import PluginEditorComponent from "../../../pages/ExperimentBuilder/components/PluginEditor";

const hoistedMocks = vi.hoisted(() => ({
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
      onChange={(event) => onChange(event.target.value)}
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
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

vi.mock("../../../pages/ExperimentBuilder/hooks/usePlugins", () => ({
  default: () => ({
    plugins: hoistedMocks.plugins,
    setPlugins: hoistedMocks.setPlugins,
  }),
}));

vi.mock("../../../pages/ExperimentBuilder/hooks/useTrials", () => ({
  default: () => ({
    selectedTrial: hoistedMocks.selectedTrial,
    updateTrial: hoistedMocks.updateTrial,
    setSelectedTrial: hoistedMocks.setSelectedTrial,
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

export const mocks = hoistedMocks;

export function PluginEditor(
  props: ComponentProps<typeof PluginEditorComponent>,
) {
  return <PluginEditorComponent {...props} />;
}

export function registerPluginEditorLifecycle() {
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
}
