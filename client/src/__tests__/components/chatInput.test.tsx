import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ChatInput from "../../components/Chat/ChatInput";

const mocks = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  abortStream: vi.fn(),
  isThinking: false,
}));

vi.mock("../../contexts/ChatContext", () => ({
  useChat: () => ({
    sendMessage: mocks.sendMessage,
    abortStream: mocks.abortStream,
    isThinking: mocks.isThinking,
  }),
}));

describe("ChatInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isThinking = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses quick hints, sends trimmed text with Enter and clears the textarea", () => {
    render(<ChatInput showHints />);

    fireEvent.click(screen.getByText("Why is my experiment failing?"));

    const textarea = screen.getByPlaceholderText(
      /Tell the agent what you need/,
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe("Why is my experiment failing?");

    fireEvent.change(textarea, { target: { value: "  Run analysis  " } });
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(mocks.sendMessage).toHaveBeenCalledWith("Run analysis", undefined);
    expect(textarea.value).toBe("");
  });

  it("shows the stop control while thinking and aborts the stream", () => {
    mocks.isThinking = true;

    render(<ChatInput />);

    fireEvent.click(screen.getByTitle("Stop"));

    expect(mocks.abortStream).toHaveBeenCalledTimes(1);
    expect(screen.queryByTitle("Send (Enter)")).not.toBeInTheDocument();
  });

  it("ignores blank submits and submits nothing while thinking", () => {
    const { rerender } = render(<ChatInput />);
    const textarea = screen.getByPlaceholderText(/Tell the agent what you need/);

    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(mocks.sendMessage).not.toHaveBeenCalled();

    mocks.isThinking = true;
    rerender(<ChatInput />);
    fireEvent.change(screen.getByPlaceholderText(/Tell the agent what you need/), {
      target: { value: "Please wait" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText(/Tell the agent what you need/), {
      key: "Enter",
    });

    expect(mocks.sendMessage).not.toHaveBeenCalled();
  });

  it("opens the hidden file input from the attach button", () => {
    const clickSpy = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => {});

    render(<ChatInput />);

    fireEvent.click(screen.getByTitle("Attach file"));

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("ignores multiline keys and file events without files", () => {
    const { container } = render(<ChatInput />);
    const textarea = screen.getByPlaceholderText(/Tell the agent what you need/);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const dropZone = container.querySelector(".chat-input-wrap") as HTMLElement;

    fireEvent.change(textarea, { target: { value: "Keep editing" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    fireEvent.change(input, { target: { files: null } });
    fireEvent.drop(dropZone, { dataTransfer: { files: null } });

    expect(mocks.sendMessage).not.toHaveBeenCalled();
    expect(screen.queryByText("Drop files here")).not.toBeInTheDocument();
  });

  it("attaches selected files and sends them with the message", async () => {
    render(<ChatInput />);

    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
      await Promise.resolve();
    });

    expect(await screen.findByText("notes.txt")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Tell the agent what you need/), {
      target: { value: "Use this file" },
    });
    fireEvent.click(screen.getByTitle("Send (Enter)"));

    await waitFor(() => {
      expect(mocks.sendMessage).toHaveBeenCalledWith(
        "Use this file",
        [
          expect.objectContaining({
            name: "notes.txt",
            type: "text/plain",
            size: file.size,
            file,
          }),
        ],
      );
    });
    expect(screen.queryByText("notes.txt")).not.toBeInTheDocument();
  });

  it("handles dropped image files, drag overlay state and attachment removal", async () => {
    const { container } = render(<ChatInput />);
    const dropZone = container.querySelector(".chat-input-wrap") as HTMLElement;
    const image = new File(["image"], "photo.png", { type: "image/png" });

    fireEvent.dragOver(dropZone, { dataTransfer: { files: [] } });
    expect(screen.getByText("Drop files here")).toBeInTheDocument();

    fireEvent.dragLeave(dropZone);
    expect(screen.queryByText("Drop files here")).not.toBeInTheDocument();

    fireEvent.dragOver(dropZone, { dataTransfer: { files: [] } });
    await act(async () => {
      fireEvent.drop(dropZone, { dataTransfer: { files: [image] } });
      await Promise.resolve();
    });

    expect(await screen.findByText("photo.png")).toBeInTheDocument();
    expect(screen.getByAltText("photo.png")).toBeInTheDocument();
    expect(screen.queryByText("Drop files here")).not.toBeInTheDocument();

    fireEvent.click(container.querySelector(".chat-attach-remove") as HTMLElement);
    expect(screen.queryByText("photo.png")).not.toBeInTheDocument();
  });
});
