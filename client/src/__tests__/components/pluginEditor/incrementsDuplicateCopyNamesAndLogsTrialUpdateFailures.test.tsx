import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  mocks,
  PluginEditor,
  registerPluginEditorLifecycle,
} from "./testHarness";

describe("PluginEditor", () => {
  registerPluginEditorLifecycle();

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
});
