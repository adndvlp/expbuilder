import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PluginEditor from "../../pages/ExperimentBuilder/components/PluginEditor";

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
  updateTrial: vi.fn(async (_id: string | number, patch: Record<string, unknown>) => ({
    id: 7,
    name: "Trial 7",
    plugin: patch.plugin,
  })),
  setSelectedTrial: vi.fn(),
  mediaChangeHandler: undefined as ((event: MediaQueryListEvent) => void) | undefined,
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
      addEventListener: vi.fn((_event: string, handler: (event: MediaQueryListEvent) => void) => {
        mocks.mediaChangeHandler = handler;
      }),
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

  it("uses the fallback plugin and reacts to color-scheme changes", () => {
    const { unmount } = render(<PluginEditor selectedPluginName="missing" />);

    expect(screen.getByDisplayValue("starter")).toBeInTheDocument();
    expect(screen.getByLabelText("Plugin code")).toHaveAttribute(
      "data-theme",
      "vs-light",
    );

    act(() => {
      mocks.mediaChangeHandler?.({ matches: false } as MediaQueryListEvent);
    });

    expect(screen.getByLabelText("Plugin code")).toHaveAttribute(
      "data-theme",
      "vs-dark",
    );

    unmount();
    expect(mocks.mediaQuery?.removeEventListener).toHaveBeenCalledWith(
      "change",
      mocks.mediaChangeHandler,
    );
  });

  it("renders without matchMedia and ignores empty file selections", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: undefined,
    });

    render(<PluginEditor selectedPluginName="starter" />);

    const upload = screen.getByLabelText("Upload JS plugin file");
    fireEvent.change(upload, { target: { files: [] } });
    fireEvent.change(upload, { target: { files: null } });

    expect(screen.getByLabelText("Plugin code")).toHaveAttribute(
      "data-theme",
      "vs-dark",
    );
    expect(mocks.setPlugins).not.toHaveBeenCalled();
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

  it("overwrites the selected slot when the uploaded file has the same plugin name", async () => {
    mocks.updateTrial.mockResolvedValueOnce(null);
    render(<PluginEditor selectedPluginName="starter" />);

    const file = new File(["plugin"], "starter.js", {
      type: "application/javascript",
    });
    fireEvent.change(screen.getByLabelText("Upload JS plugin file"), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(mocks.setPlugins).toHaveBeenCalledWith([
        {
          name: "starter",
          scripTag: "/plugins/starter.js",
          pluginCode: "// uploaded starter.js",
          index: 0,
        },
        mocks.plugins[1],
      ]);
    });
    expect(mocks.setSelectedTrial).not.toHaveBeenCalled();
  });

  it("increments duplicate copy names and logs trial update failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.plugins = [
      ...mocks.makePlugins(),
      {
        name: "starter copy",
        scripTag: "/plugins/starter copy.js",
        pluginCode: "class StarterCopy {}",
        index: 2,
      },
    ];
    mocks.updateTrial.mockRejectedValueOnce(new Error("trial update failed"));

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
          name: "starter copy2",
          scripTag: "/plugins/starter copy2.js",
          pluginCode: "// uploaded starter.js",
          index: 3,
        },
      ]);
    });
    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        "Error updating trial plugin:",
        expect.any(Error),
      );
    });
  });

  it("creates a first plugin without assigning non-plugin trials and keeps plugin-only handlers guarded", async () => {
    mocks.plugins = [];
    mocks.selectedTrial = { id: 9, type: "Group", name: "Group" };
    render(<PluginEditor selectedPluginName="missing" />);

    const file = new File(["plugin"], "first.js", {
      type: "application/javascript",
    });
    fireEvent.change(screen.getByLabelText("Upload JS plugin file"), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(mocks.setPlugins).toHaveBeenCalledWith([
        {
          name: "first",
          scripTag: "/plugins/first.js",
          pluginCode: "// uploaded first.js",
          index: 0,
        },
      ]);
    });
    expect(mocks.updateTrial).not.toHaveBeenCalled();

    fireEvent.change(screen.getByDisplayValue("first"), {
      target: { value: "ignored" },
    });
    fireEvent.click(screen.getByText("Delete Plugin"));

    expect(mocks.setPlugins).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).not.toHaveBeenCalled();
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

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(mocks.setPlugins).toHaveBeenCalledWith([
      {
        name: "starter",
        scripTag: "/plugins/starter.js",
        pluginCode: "class Renamed {}",
        index: 0,
      },
      mocks.plugins[1],
    ]);
    expect(screen.getByText("Saved Changes")).toHaveStyle({ opacity: "1" });

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByText("Saved Changes")).toHaveStyle({ opacity: "0" });
  });

  it("falls back to empty plugin code when the editor clears its value", () => {
    vi.useFakeTimers();
    render(<PluginEditor selectedPluginName="starter" />);

    fireEvent.change(screen.getByLabelText("Plugin code"), {
      target: { value: "" },
    });

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(mocks.setPlugins).toHaveBeenCalledWith([
      {
        name: "starter",
        scripTag: "/plugins/starter.js",
        pluginCode: "",
        index: 0,
      },
      mocks.plugins[1],
    ]);
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
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error("delete failed"));
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
