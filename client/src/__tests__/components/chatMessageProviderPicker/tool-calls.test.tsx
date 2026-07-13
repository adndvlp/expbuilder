import {
  message,
  registerChatmessageAndToolCallCardHooks,
  toolCall,
} from "./testHarness";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ChatMessage from "../../../components/Chat/ChatMessage";
import ToolCallCard from "../../../components/Chat/ToolCallCard";

describe("ChatMessage and ToolCallCard", () => {
  registerChatmessageAndToolCallCardHooks();

  it("renders inline code, large file sizes and tool calls inside messages", () => {
    render(
      <ChatMessage
        message={message({
          content: "Run `npm test`",
          attachments: [
            {
              id: "small-file",
              name: "tiny.txt",
              type: "text/plain",
              url: "blob:tiny",
              size: 512,
            },
            {
              id: "big-file",
              name: "dataset.bin",
              type: "application/octet-stream",
              url: "blob:dataset",
              size: 2 * 1048576,
            },
          ],
          toolCalls: [
            toolCall({
              name: "readFile",
              args: { path: "client/package.json" },
              status: "running",
            }),
          ],
        })}
      />,
    );

    expect(screen.getByText("npm test").tagName.toLowerCase()).toBe("code");
    expect(screen.getByText("512 B")).toBeInTheDocument();
    expect(screen.getByText("2.0 MB")).toBeInTheDocument();
    expect(screen.getByText("readFile()")).toBeInTheDocument();
  });

  it("toggles tool call details and renders done/error status details", () => {
    const { container, rerender } = render(
      <ToolCallCard
        toolCall={toolCall({
          description: "Update selected trial",
          args: { trialId: 7, plugin: "html-keyboard-response" },
          result: "updated",
          durationMs: 42,
        })}
      />,
    );

    expect(screen.getByText("updateTrial()")).toBeInTheDocument();
    expect(screen.getByText("Update selected trial")).toBeInTheDocument();
    expect(screen.getByText("42ms")).toBeInTheDocument();
    expect(container.querySelector(".chat-tool-body")).not.toHaveClass("open");

    fireEvent.click(container.querySelector(".chat-tool-header")!);

    expect(container.querySelector(".chat-tool-body")).toHaveClass("open");
    expect(screen.getByText("Parameters")).toBeInTheDocument();
    expect(screen.getByText(/"trialId": 7/)).toBeInTheDocument();
    expect(screen.getByText("updated")).toBeInTheDocument();

    rerender(
      <ToolCallCard
        toolCall={toolCall({
          id: "tool-err",
          status: "error",
          result: "failed to update",
          args: {},
        })}
      />,
    );

    expect(container.querySelector(".chat-tool-card")).toHaveClass("error");
    fireEvent.click(container.querySelector(".chat-tool-header")!);
    expect(screen.getByText("failed to update")).toHaveClass("error");

    rerender(
      <ToolCallCard
        toolCall={toolCall({
          id: "tool-pending",
          status: "pending",
          result: undefined,
          args: {},
        })}
      />,
    );
    expect(container.querySelector(".chat-tool-pending")).toBeInTheDocument();
  });
});
