import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  mocks,
  PluginEditor,
  registerPluginEditorLifecycle,
} from "./testHarness";

describe("PluginEditor", () => {
  registerPluginEditorLifecycle();

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
});
