import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatProvider, useChat } from "../../contexts/ChatContext";
import ChatFAB from "../../components/Chat/ChatFAB";
import ChatPanel from "../../components/Chat/ChatPanel";

const catalogMocks = vi.hoisted(() => ({
  prefetchProviders: vi.fn(),
  loadProviders: vi.fn(async () => []),
  findCatalogProvider: vi.fn(() => undefined),
}));

vi.mock("../../lib/providerCatalog", () => ({
  prefetchProviders: catalogMocks.prefetchProviders,
  loadProviders: catalogMocks.loadProviders,
  findCatalogProvider: catalogMocks.findCatalogProvider,
}));

function jsonResponse(payload: unknown, ok = true): Response {
  return {
    ok,
    statusText: ok ? "OK" : "Bad Request",
    json: vi.fn(async () => payload),
  } as unknown as Response;
}

function streamResponse(body: string): Response {
  const encoder = new TextEncoder();
  return {
    ok: true,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(body));
        controller.close();
      },
    }),
  } as unknown as Response;
}

function installFetch(options?: {
  settings?: Record<string, unknown>;
  conversations?: unknown[];
  streamBody?: string;
  pendingStream?: (signal: AbortSignal) => Promise<Response>;
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "http://localhost:3000/api/chat/settings") {
        if (init?.method === "PATCH") return jsonResponse({ success: true });
        return jsonResponse(options?.settings ?? {});
      }
      if (url === "http://localhost:3000/api/chat/conversations") {
        if (init?.method === "PUT") return jsonResponse({ success: true });
        return jsonResponse(options?.conversations ?? []);
      }
      if (url === "http://localhost:3000/api/chat/stream") {
        if (options?.pendingStream) {
          return options.pendingStream(init?.signal as AbortSignal);
        }
        return streamResponse(options?.streamBody ?? "event: done\ndata: {}\n\n");
      }
      return jsonResponse({ success: true });
    }),
  );
}

function fetchMock() {
  return vi.mocked(fetch);
}

function patchCalls() {
  return fetchMock().mock.calls.filter(
    ([url, init]) =>
      url === "http://localhost:3000/api/chat/settings" &&
      (init as RequestInit | undefined)?.method === "PATCH",
  );
}

function putCalls() {
  return fetchMock().mock.calls.filter(
    ([url, init]) =>
      url === "http://localhost:3000/api/chat/conversations" &&
      (init as RequestInit | undefined)?.method === "PUT",
  );
}

function streamCallBody() {
  const call = fetchMock().mock.calls.find(
    ([url]) => url === "http://localhost:3000/api/chat/stream",
  );
  expect(call).toBeTruthy();
  return JSON.parse((call?.[1] as RequestInit).body as string);
}

function ChatProbe() {
  const chat = useChat();
  const messages = chat.activeConversation?.messages ?? [];

  return (
    <div>
      <div data-testid="open">{String(chat.isOpen)}</div>
      <div data-testid="thinking">{String(chat.isThinking)}</div>
      <div data-testid="provider">{`${chat.provider.id}:${chat.model.id}`}</div>
      <div data-testid="api-key">{chat.apiKeys.openai ?? ""}</div>
      <div data-testid="active-title">{chat.activeConversation?.title ?? "none"}</div>
      <div data-testid="messages">
        {messages.map((msg) =>
          `${msg.role}|${msg.content}|${msg.reasoning ?? ""}|${String(
            msg.isStreaming,
          )}`,
        ).join("\n")}
      </div>
      <button onClick={chat.open}>open</button>
      <button onClick={() => chat.renameConversation("conv-1", "Renamed chat")}>
        rename
      </button>
      <button onClick={() => chat.setApiKey("openai", "sk-new")}>set key</button>
      <button onClick={() => chat.setProviderAndModel("google", "gemini-2.0-flash")}>
        set provider
      </button>
      <button onClick={() => chat.sendMessage("Build this experiment")}>send</button>
      <button onClick={chat.abortStream}>abort</button>
    </div>
  );
}

describe("ChatProvider flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    cleanup();
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
    expect(screen.getByTestId("provider")).toHaveTextContent("openai:gpt-4o-mini");
    expect(screen.getByTestId("api-key")).toHaveTextContent("sk-old");
    expect(catalogMocks.prefetchProviders).toHaveBeenCalled();

    vi.useFakeTimers();

    fireEvent.click(screen.getByText("rename"));
    expect(screen.getByTestId("active-title")).toHaveTextContent("Renamed chat");

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
      conversations: [],
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
      expect(capturedSignal).not.toBeNull();
      expect(screen.getByTestId("thinking")).toHaveTextContent("true");
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

  it("opens the floating chat panel and renders the empty conversation surface", async () => {
    installFetch({ conversations: [] });
    const { container } = render(
      <ChatProvider>
        <ChatFAB />
        <ChatPanel />
      </ChatProvider>,
    );

    expect(screen.queryByText("ExpBuilder Agent")).not.toBeInTheDocument();

    fireEvent.click(container.querySelector(".chat-fab")!);

    expect(await screen.findByText("ExpBuilder Agent")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Tell the agent what you need/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("History"));

    expect(screen.getByText("Conversations")).toBeInTheDocument();
    expect(
      screen.getByText("No conversations yet. Start chatting with the agent."),
    ).toBeInTheDocument();
  });
});
