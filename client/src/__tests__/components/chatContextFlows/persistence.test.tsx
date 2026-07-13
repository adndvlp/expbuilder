import {
  ChatProbe,
  catalogMocks,
  installFetch,
  jsonResponse,
  patchCalls,
  putCalls,
  registerChatproviderFlowsHooks,
} from "./testHarness";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatProvider, parseSSEChunk } from "../../../contexts/ChatContext";

describe("ChatProvider flows", () => {
  registerChatproviderFlowsHooks();

  it("parses default SSE events and ignores blocks without data", () => {
    expect(parseSSEChunk("data: payload\nignored line\n\n")).toEqual([
      { event: "message", data: "payload" },
    ]);
    expect(parseSSEChunk("event: ping\nignored line\n\n")).toEqual([]);
  });

  it("loads persisted settings/conversations and debounces persistence updates", async () => {
    installFetch({
      settings: {
        apiKeys: { openai: "sk-old" },
        activeProvider: "openai",
        activeModel: "gpt-4o-mini",
      },
      conversations: [
        {
          id: "conv-1",
          title: "Saved chat",
          createdAt: "2026-05-24T10:00:00.000Z",
          updatedAt: "2026-05-24T10:00:00.000Z",
          messages: [
            {
              id: "msg-1",
              role: "user",
              content: "Previous question",
              timestamp: "2026-05-24T10:00:00.000Z",
            },
          ],
        },
      ],
    });

    render(
      <ChatProvider>
        <ChatProbe />
      </ChatProvider>,
    );

    expect(await screen.findByText("Saved chat")).toBeInTheDocument();
    expect(screen.getByTestId("provider")).toHaveTextContent(
      "openai:gpt-4o-mini",
    );
    expect(screen.getByTestId("api-key")).toHaveTextContent("sk-old");
    expect(catalogMocks.prefetchProviders).toHaveBeenCalled();

    vi.useFakeTimers();

    fireEvent.click(screen.getByText("rename"));
    expect(screen.getByTestId("active-title")).toHaveTextContent(
      "Renamed chat",
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(putCalls().at(-1)?.[1]).toEqual(
      expect.objectContaining({
        method: "PUT",
        body: expect.stringContaining("Renamed chat"),
      }),
    );

    fireEvent.click(screen.getByText("set key"));
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(patchCalls().at(-1)?.[1]).toEqual(
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          apiKeys: { openai: "sk-new" },
          activeProvider: "openai",
          activeModel: "gpt-4o-mini",
        }),
      }),
    );

    fireEvent.click(screen.getByText("set provider"));
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(patchCalls().at(-1)?.[1]).toEqual(
      expect.objectContaining({
        method: "PATCH",
        body: expect.stringContaining('"activeProvider":"google"'),
      }),
    );
  });

  it("swallows load and debounced persistence rejections", async () => {
    const failingFetch = vi.fn((url: string, init?: RequestInit) => {
      if (!init) return Promise.reject(new Error("load failed"));
      if (
        url === "http://localhost:3000/api/chat/settings" &&
        init.method === "PATCH"
      ) {
        return Promise.reject(new Error("settings save failed"));
      }
      if (
        url === "http://localhost:3000/api/chat/conversations" &&
        init.method === "PUT"
      ) {
        return Promise.reject(new Error("conversation save failed"));
      }
      return Promise.resolve(jsonResponse({ success: true }));
    });
    vi.stubGlobal("fetch", failingFetch);

    render(
      <ChatProvider>
        <ChatProbe />
      </ChatProvider>,
    );

    await waitFor(() => {
      expect(failingFetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/chat/settings",
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    vi.useFakeTimers();
    fireEvent.click(screen.getByText("set key"));
    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });
    expect(failingFetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/chat/settings",
      expect.objectContaining({ method: "PATCH" }),
    );

    fireEvent.click(screen.getByText("new conversation"));
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    expect(failingFetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/chat/conversations",
      expect.objectContaining({ method: "PUT" }),
    );
  });
});
