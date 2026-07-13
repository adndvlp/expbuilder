import { textComponent } from "./testHarness";
import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CanvasContextMenu from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/CanvasContextMenu";
import TextEditingOverlay from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/TextEditingOverlay";
import useHandleResize from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/useHandleResize";

describe("coverage designer small components", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runs context menu actions, respects disabled items and closes after actions", () => {
    const actions = {
      onCopy: vi.fn(),
      onCut: vi.fn(),
      onPaste: vi.fn(),
      onDelete: vi.fn(),
      onSelectAll: vi.fn(),
      onUndo: vi.fn(),
      onClose: vi.fn(),
    };
    const { container, rerender } = render(
      <CanvasContextMenu
        state={null}
        canCopy={false}
        canPaste={false}
        canUndo={false}
        hasComponents={false}
        {...actions}
      />,
    );
    expect(container).toBeEmptyDOMElement();

    rerender(
      <CanvasContextMenu
        state={{ x: 40, y: 50 }}
        canCopy={false}
        canPaste
        canUndo={false}
        hasComponents
        {...actions}
      />,
    );
    expect(
      screen.getByRole("menu", { name: "Canvas actions" }),
    ).toBeInTheDocument();
    const disabledCopy = screen.getByRole("menuitem", { name: /Copy/ });
    expect(disabledCopy).toBeDisabled();
    fireEvent.mouseEnter(disabledCopy);

    const paste = screen.getByRole("menuitem", { name: /Paste/ });
    fireEvent.mouseEnter(paste);
    expect(paste).toHaveStyle({ background: "#e5edf8" });
    fireEvent.mouseLeave(paste);
    fireEvent.click(paste);
    expect(actions.onPaste).toHaveBeenCalled();
    expect(actions.onClose).toHaveBeenCalled();

    rerender(
      <CanvasContextMenu
        state={{ x: 40, y: 50 }}
        canCopy
        canPaste
        canUndo
        hasComponents
        {...actions}
      />,
    );
    const menu = screen.getByRole("menu", { name: "Canvas actions" });
    fireEvent.contextMenu(menu);
    fireEvent.mouseDown(menu);
    fireEvent.click(screen.getByRole("menuitem", { name: /Copy/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Cut/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Undo/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Select All/ }));
    expect(actions.onCopy).toHaveBeenCalled();
    expect(actions.onCut).toHaveBeenCalled();
    expect(actions.onDelete).toHaveBeenCalled();
    expect(actions.onUndo).toHaveBeenCalled();
    expect(actions.onSelectAll).toHaveBeenCalled();
  });

  it("commits, cancels and hides the text editing overlay for unsupported components", async () => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    const { rerender, container } = render(
      <TextEditingOverlay
        component={null}
        stageScale={1}
        canvasWidth={640}
        onCommit={onCommit}
        onCancel={onCancel}
      />,
    );
    expect(container).toBeEmptyDOMElement();

    rerender(
      <TextEditingOverlay
        component={textComponent()}
        stageScale={2}
        canvasWidth={640}
        onCommit={onCommit}
        onCancel={onCancel}
      />,
    );
    const textarea = await screen.findByDisplayValue("Hello");
    fireEvent.change(textarea, { target: { value: "Updated" } });
    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });
    fireEvent.blur(textarea);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("Updated");

    rerender(
      <TextEditingOverlay
        component={textComponent({ id: "text-2" })}
        stageScale={1}
        canvasWidth={640}
        onCommit={onCommit}
        onCancel={onCancel}
      />,
    );
    const secondTextarea = await screen.findByDisplayValue("Hello");
    fireEvent.keyDown(secondTextarea, { key: "Escape" });
    fireEvent.keyDown(secondTextarea, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);

    rerender(
      <TextEditingOverlay
        component={textComponent({
          id: "text-fallbacks",
          width: 0,
          height: 0,
          rotation: 0,
          config: {
            text: { source: "typed", value: "Fallback sizing" },
            font_size: { source: "typed", value: 20 },
            background_color: { source: "typed", value: "#123456" },
          },
        })}
        stageScale={1}
        canvasWidth={640}
        onCommit={onCommit}
        onCancel={onCancel}
      />,
    );
    const fallbackTextarea = await screen.findByDisplayValue("Fallback sizing");
    expect(fallbackTextarea).toHaveStyle({
      transform: "rotate(0deg)",
      background: "#123456",
    });
    expect(fallbackTextarea.style.width).not.toBe("0px");
    expect(fallbackTextarea.style.height).not.toBe("0px");

    rerender(
      <TextEditingOverlay
        component={textComponent({ id: "image-1", type: "ImageComponent" })}
        stageScale={1}
        canvasWidth={640}
        onCommit={onCommit}
        onCancel={onCancel}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("resizes left and right designer panels from document mouse events", () => {
    const setShowLeftPanel = vi.fn();
    const setLeftPanelWidth = vi.fn();
    const setShowRightPanel = vi.fn();
    const setRightPanelWidth = vi.fn();
    const isResizingLeft = { current: true };
    const isResizingRight = { current: false };
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1000,
    });

    const { unmount } = renderHook(() =>
      useHandleResize({
        isResizingLeft,
        setShowLeftPanel,
        setLeftPanelWidth,
        isResizingRight,
        setShowRightPanel,
        setRightPanelWidth,
      }),
    );

    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 260 }));
    expect(setLeftPanelWidth).toHaveBeenCalledWith(240);
    expect(setShowLeftPanel).toHaveBeenCalledWith(true);

    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 100 }));
    expect(setShowLeftPanel).toHaveBeenCalledWith(false);

    isResizingLeft.current = false;
    isResizingRight.current = true;
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 500 }));
    expect(setRightPanelWidth).toHaveBeenCalledWith(450);
    expect(setShowRightPanel).toHaveBeenCalledWith(true);

    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 800 }));
    expect(setShowRightPanel).toHaveBeenCalledWith(false);

    document.dispatchEvent(new MouseEvent("mouseup"));
    expect(isResizingLeft.current).toBe(false);
    expect(isResizingRight.current).toBe(false);
    unmount();
  });
});
