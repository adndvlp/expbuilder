import {
  installClipboard,
  message,
  registerChatmessageAndToolCallCardHooks,
} from "./testHarness";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ChatMessage from "../../../components/Chat/ChatMessage";

describe("ChatMessage and ToolCallCard", () => {
  registerChatmessageAndToolCallCardHooks();

  it("renders user attachments with image previews, file names and compact sizes", () => {
    render(
      <ChatMessage
        message={message({
          role: "user",
          content: "Use these assets",
          attachments: [
            {
              id: "img-1",
              name: "stimulus.png",
              type: "image/png",
              url: "blob:image",
              size: 512,
            },
            {
              id: "file-1",
              name: "conditions.csv",
              type: "text/csv",
              url: "blob:csv",
              size: 2048,
            },
          ],
        })}
      />,
    );

    expect(screen.getByText("Use these assets")).toBeInTheDocument();
    expect(screen.getByAltText("stimulus.png")).toHaveAttribute(
      "src",
      "blob:image",
    );
    expect(screen.getByText("conditions.csv")).toBeInTheDocument();
    expect(screen.getByText("2.0 KB")).toBeInTheDocument();
  });

  it("renders assistant reasoning collapsed and expands it on click", () => {
    render(
      <ChatMessage
        message={message({
          content: "",
          reasoning: "I need to inspect the experiment timeline first.",
          isStreaming: true,
        })}
      />,
    );

    expect(screen.getByText("Thinking…")).toBeInTheDocument();
    expect(
      screen.queryByText("I need to inspect the experiment timeline first."),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Thinking…"));

    expect(
      screen.getByText("I need to inspect the experiment timeline first."),
    ).toBeInTheDocument();
  });

  it("renders completed reasoning and the empty streaming placeholder", () => {
    const { rerender } = render(
      <ChatMessage
        message={message({
          content: "Done",
          reasoning: "Finished reasoning",
          isStreaming: false,
        })}
      />,
    );

    expect(screen.getByText("Thought for a bit")).toBeInTheDocument();

    rerender(
      <ChatMessage
        message={message({
          content: "",
          reasoning: undefined,
          isStreaming: true,
        })}
      />,
    );

    expect(screen.getByText("Typing…")).toBeInTheDocument();
  });

  it("renders fenced code blocks with a copy action and streaming cursor", async () => {
    vi.useFakeTimers();
    const writeText = installClipboard();

    render(
      <ChatMessage
        message={message({
          content: "```ts\nconst ok = true;\n```",
          isStreaming: true,
        })}
      />,
    );

    expect(screen.getByText("ts")).toBeInTheDocument();
    expect(screen.getByTestId("syntax-highlighter")).toHaveTextContent(
      "const ok = true;",
    );

    await act(async () => {
      fireEvent.click(screen.getByText("copy"));
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith("const ok = true;");
    expect(screen.getByText("✓ copied")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText("copy")).toBeInTheDocument();
    expect(document.querySelector(".chat-cursor")).toBeInTheDocument();
  });
});
