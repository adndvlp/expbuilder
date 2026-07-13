import {
  ChatProbe,
  fetchMock,
  installFetch,
  registerChatproviderFlowsHooks,
  streamCallBody,
} from "./testHarness";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatProvider } from "../../../contexts/ChatContext";
import ChatFAB from "../../../components/Chat/ChatFAB";

describe("ChatProvider flows", () => {
  registerChatproviderFlowsHooks();

  it("streams assistant deltas, extracts reasoning and emits data-change events", async () => {
    const dataChanged = vi.fn();
    window.addEventListener("experiment-data-changed", dataChanged);
    installFetch({
      conversations: [],
      streamBody:
        'event: delta\ndata: {"text":"<think>plan</think>Hello"}\n\n' +
        'event: delta\ndata: {"text":" world"}\n\n' +
        'event: done\ndata: {"toolsUsed":true}\n\n',
    });

    render(
      <ChatProvider>
        <ChatProbe />
      </ChatProvider>,
    );

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        "http://localhost:3000/api/chat/conversations",
      );
    });

    fireEvent.click(screen.getByText("send"));

    await waitFor(() => {
      expect(screen.getByTestId("messages")).toHaveTextContent(
        "assistant|Hello world|plan|false",
      );
    });

    expect(streamCallBody()).toEqual(
      expect.objectContaining({
        messages: [{ role: "user", content: "Build this experiment" }],
      }),
    );
    expect(dataChanged).toHaveBeenCalledTimes(1);

    window.removeEventListener("experiment-data-changed", dataChanged);
  });

  it("aborts an in-flight stream and clears streaming UI state", async () => {
    let capturedSignal: AbortSignal | null = null;
    installFetch({
      conversations: [
        {
          id: "conv-1",
          title: "Active chat",
          createdAt: "2026-05-24T10:00:00.000Z",
          updatedAt: "2026-05-24T10:00:00.000Z",
          messages: [],
        },
        {
          id: "conv-2",
          title: "Inactive chat",
          createdAt: "2026-05-23T10:00:00.000Z",
          updatedAt: "2026-05-23T10:00:00.000Z",
          messages: [],
        },
      ],
      pendingStream: (signal) => {
        capturedSignal = signal;
        return new Promise<Response>((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        });
      },
    });

    const { container } = render(
      <ChatProvider>
        <ChatProbe />
        <ChatFAB />
      </ChatProvider>,
    );

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        "http://localhost:3000/api/chat/conversations",
      );
    });

    fireEvent.click(screen.getByText("send"));

    await waitFor(() => {
      expect(capturedSignal).not.toBeNull();
      expect(screen.getByTestId("thinking")).toHaveTextContent("true");
      expect(container.querySelectorAll(".chat-fab-ring")).toHaveLength(2);
    });

    fireEvent.click(screen.getByText("abort"));

    await waitFor(() => {
      expect(capturedSignal?.aborted).toBe(true);
      expect(screen.getByTestId("thinking")).toHaveTextContent("false");
      expect(screen.getByTestId("messages")).toHaveTextContent(
        "assistant|||false",
      );
    });
  });
});
