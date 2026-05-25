import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PluginEditor from "../../pages/ExperimentBuilder/components/PluginEditor";

const mocks = vi.hoisted(() => ({
  plugins: [
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
  setPlugins: vi.fn(),
  selectedTrial: {
    id: 7,
    type: "Trial",
    name: "Trial 7",
    plugin: "starter",
    parameters: {},
    trialCode: "",
  },
  updateTrial: vi.fn(async (_id: string | number, patch: Record<string, unknown>) => ({
    id: 7,
    name: "Trial 7",
    plugin: patch.plugin,
  })),
  setSelectedTrial: vi.fn(),
}));

vi.mock("@monaco-editor/react", () => ({
  Editor: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea
      aria-label="Plugin code"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea
      aria-label="Plugin code"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock("../../pages/ExperimentBuilder/hooks/usePlugins", () => ({
  default: () => ({
    plugins: mocks.plugins,
    setPlugins: mocks.setPlugins,
  }),
}));

vi.mock("../../pages/ExperimentBuilder/hooks/useTrials", () => ({
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

describe("PluginEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("FileReader", FileReaderMock);
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uploads a JS plugin, replaces the selected plugin slot and assigns it to the selected trial", async () => {
    render(<PluginEditor selectedPluginName="starter" />);

    const file = new File(["plugin"], "uploaded-plugin.js", {
      type: "application/javascript",
    });
    fireEvent.change(screen.getByLabelText("Upload JS plugin file"), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(mocks.setPlugins).toHaveBeenCalledWith([
        {
          name: "uploaded-plugin",
          scripTag: "/plugins/uploaded-plugin.js",
          pluginCode: "// uploaded uploaded-plugin.js",
          index: 0,
        },
        mocks.plugins[1],
      ]);
    });
    expect(mocks.updateTrial).toHaveBeenCalledWith(7, {
      plugin: "uploaded-plugin",
    });
    await waitFor(() => {
      expect(mocks.setSelectedTrial).toHaveBeenCalledWith({
        id: 7,
        name: "Trial 7",
        plugin: "uploaded-plugin",
      });
    });
    expect(screen.getByDisplayValue("uploaded-plugin")).toBeInTheDocument();
  });

  it("creates a copy name when uploading a duplicate plugin name from another slot", async () => {
    render(<PluginEditor selectedPluginName="existing" />);

    const file = new File(["plugin"], "starter.js", {
      type: "application/javascript",
    });
    fireEvent.change(screen.getByLabelText("Upload JS plugin file"), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(mocks.setPlugins).toHaveBeenCalledWith([
        ...mocks.plugins,
        {
          name: "starter copy",
          scripTag: "/plugins/starter copy.js",
          pluginCode: "// uploaded starter.js",
          index: 2,
        },
      ]);
    });
    expect(mocks.updateTrial).toHaveBeenCalledWith(7, {
      plugin: "starter copy",
    });
  });

  it("debounces manual plugin name and code edits through setPlugins", () => {
    vi.useFakeTimers();
    render(<PluginEditor selectedPluginName="starter" />);

    fireEvent.change(screen.getByDisplayValue("starter"), {
      target: { value: "renamed" },
    });
    fireEvent.change(screen.getByLabelText("Plugin code"), {
      target: { value: "class Renamed {}" },
    });

    expect(mocks.setPlugins).not.toHaveBeenCalled();

    vi.advanceTimersByTime(3000);

    expect(mocks.setPlugins).toHaveBeenCalledWith([
      {
        name: "starter",
        scripTag: "/plugins/starter.js",
        pluginCode: "class Renamed {}",
        index: 0,
      },
      mocks.plugins[1],
    ]);
  });

  it("deletes the current plugin through the backend when confirmed", async () => {
    vi.useFakeTimers();
    vi.spyOn(window, "confirm").mockReturnValue(true);

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
  });
});
