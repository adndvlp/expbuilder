import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Modal from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/Modal";
import { isEditorModalOpen } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/modalMarker";

describe("content editor modal marker", () => {
  it("marks the designer while a content editor is open and closes it with Escape", () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <Modal isOpen onClose={onClose} suppressDesignerShortcuts>
        <p>editor content</p>
      </Modal>,
    );

    expect(isEditorModalOpen()).toBe(true);
    expect(screen.getByText("editor content")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();
    expect(isEditorModalOpen()).toBe(false);
  });

  it("only the topmost editor handles Escape and plain modals never mark", () => {
    const firstClose = vi.fn();
    const secondClose = vi.fn();
    const first = render(
      <Modal isOpen onClose={firstClose} suppressDesignerShortcuts>
        <p>first editor</p>
      </Modal>,
    );
    const second = render(
      <Modal isOpen onClose={secondClose} suppressDesignerShortcuts>
        <p>second editor</p>
      </Modal>,
    );

    expect(isEditorModalOpen()).toBe(true);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(secondClose).toHaveBeenCalledTimes(1);
    expect(firstClose).not.toHaveBeenCalled();

    second.unmount();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(firstClose).toHaveBeenCalledTimes(1);
    first.unmount();
    expect(isEditorModalOpen()).toBe(false);
  });

  it("does not mark the designer for regular modals", () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <Modal isOpen onClose={onClose}>
        <p>plain modal</p>
      </Modal>,
    );

    expect(isEditorModalOpen()).toBe(false);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();

    unmount();
    expect(isEditorModalOpen()).toBe(false);
  });
});
