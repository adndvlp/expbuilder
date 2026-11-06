import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PromptModal } from "../../pages/Dashboard/PromptModal";

describe("PromptModal", () => {
  it("confirms trimmed values, blocks blank input and cancels from overlay or Escape", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { rerender, container } = render(
      <PromptModal
        isOpen={false}
        title="Experiment name:"
        placeholder="Enter name"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.queryByText("Experiment name:")).not.toBeInTheDocument();

    rerender(
      <PromptModal
        isOpen
        title="Experiment name:"
        placeholder="Enter name"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    fireEvent.submit(container.querySelector("form")!);
    fireEvent.keyDown(container.querySelector(".prompt-modal-content")!, {
      key: "ArrowDown",
    });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText("Enter name"), {
      target: { value: "  Memory Task  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(onConfirm).toHaveBeenCalledWith("Memory Task");

    fireEvent.keyDown(container.querySelector(".prompt-modal-content")!, {
      key: "Escape",
    });
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(container.querySelector(".prompt-modal-overlay")!);
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
