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
});
