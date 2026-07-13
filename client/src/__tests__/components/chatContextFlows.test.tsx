import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ChatProvider,
  parseSSEChunk,
  useChat,
} from "../../contexts/ChatContext";
import ChatFAB from "../../components/Chat/ChatFAB";
import ChatPanel from "../../components/Chat/ChatPanel";

const catalogMocks = vi.hoisted(() => ({
  prefetchProviders: vi.fn(),
  loadProviders: vi.fn(async () => []),
  findCatalogProvider: vi.fn(() => undefined),
}));

const LONG_MESSAGE =
  "Build a complete experiment with enough detail to require a shortened title";

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
  streamResponse?: Response;
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
        if (options?.streamResponse) return options.streamResponse;
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
      <div data-testid="active-id">{chat.activeConvId ?? "none"}</div>
      <div data-testid="conversation-count">{chat.conversations.length}</div>
      <div data-testid="messages">
        {messages.map((msg) =>
          `${msg.role}|${msg.content}|${msg.reasoning ?? ""}|${String(
            msg.isStreaming,
          )}`,
        ).join("\n")}
      </div>
      <button onClick={chat.open}>open</button>
      <button onClick={chat.close}>close</button>
      <button onClick={chat.toggle}>toggle</button>
      <button onClick={chat.newConversation}>new conversation</button>
      <button onClick={() => chat.selectConversation("conv-1")}>select conv one</button>
      <button onClick={() => chat.deleteConversation("conv-1")}>delete conv one</button>
      <button onClick={() => chat.deleteConversation("missing")}>delete missing</button>
      <button onClick={() => chat.renameConversation("conv-1", "Renamed chat")}>
        rename
      </button>
      <button onClick={() => chat.setApiKey("openai", "sk-new")}>set key</button>
      <button onClick={() => chat.setProviderAndModel("google", "gemini-2.0-flash")}>
        set provider
      </button>
      <button onClick={() => chat.sendMessage("   ")}>send blank</button>
      <button onClick={() => chat.sendMessage("Build this experiment")}>send</button>
      <button onClick={() => chat.sendMessage("Second request")}>send second</button>
      <button onClick={() => chat.sendMessage(LONG_MESSAGE)}>send long</button>
      <button onClick={chat.abortStream}>abort</button>
    </div>
  );
}

function UnsafeChatProbe() {
  useChat();
  return null;
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

  it("manages panel state and conversation list actions", async () => {
    installFetch({
      conversations: [
        {
          id: "conv-1",
          title: "Existing chat",
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

    expect(await screen.findByText("Existing chat")).toBeInTheDocument();

    fireEvent.click(screen.getByText("open"));
    expect(screen.getByTestId("open")).toHaveTextContent("true");
    fireEvent.click(screen.getByText("close"));
    expect(screen.getByTestId("open")).toHaveTextContent("false");
    fireEvent.click(screen.getByText("toggle"));
    expect(screen.getByTestId("open")).toHaveTextContent("true");

    fireEvent.click(screen.getByText("new conversation"));
    await waitFor(() => {
      expect(screen.getByTestId("conversation-count")).toHaveTextContent("2");
      expect(screen.getByTestId("active-title")).toHaveTextContent(
        "New conversation",
      );
    });

    fireEvent.click(screen.getByText("rename"));
    fireEvent.click(screen.getByText("delete missing"));
    expect(screen.getByTestId("active-title")).toHaveTextContent(
      "New conversation",
    );

    fireEvent.click(screen.getByText("select conv one"));
    expect(screen.getByTestId("active-id")).toHaveTextContent("conv-1");
    expect(screen.getByTestId("active-title")).toHaveTextContent("Renamed chat");
    fireEvent.click(screen.getByText("delete conv one"));

    await waitFor(() => {
      expect(screen.getByTestId("active-id")).toHaveTextContent("none");
      expect(screen.getByTestId("conversation-count")).toHaveTextContent("1");
    });
  });

  it("reuses an empty active conversation and ignores blank sends", async () => {
    installFetch({
      conversations: [
        {
          id: "conv-1",
          title: "Empty chat",
          createdAt: "2026-05-24T10:00:00.000Z",
          updatedAt: "2026-05-24T10:00:00.000Z",
          messages: [],
        },
      ],
    });

    render(
      <ChatProvider>
        <ChatProbe />
      </ChatProvider>,
    );

    expect(await screen.findByText("Empty chat")).toBeInTheDocument();
    fireEvent.click(screen.getByText("new conversation"));
    expect(screen.getByTestId("conversation-count")).toHaveTextContent("1");

    fireEvent.click(screen.getByText("send blank"));

    await waitFor(() => {
      expect(
        fetchMock().mock.calls.filter(
          ([url]) => url === "http://localhost:3000/api/chat/stream",
        ),
      ).toHaveLength(0);
    });
  });

  it("sends existing conversation history in the stream payload", async () => {
    installFetch({
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
            {
              id: "msg-2",
              role: "assistant",
              content: "Previous answer",
              timestamp: "2026-05-24T10:01:00.000Z",
            },
          ],
        },
      ],
      streamBody: "event: done\ndata: {}\n\n",
    });

    render(
      <ChatProvider>
        <ChatProbe />
      </ChatProvider>,
    );

    expect(await screen.findByText("Saved chat")).toBeInTheDocument();
    fireEvent.click(screen.getByText("send second"));

    await waitFor(() => {
      expect(streamCallBody().messages).toEqual([
        { role: "user", content: "Previous question" },
        { role: "assistant", content: "Previous answer" },
        { role: "user", content: "Second request" },
      ]);
    });
  });

  it("shortens a long first message when creating a conversation", async () => {
    installFetch({ conversations: [] });

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
    fireEvent.click(screen.getByText("send long"));

    await waitFor(() => {
      expect(screen.getByTestId("active-title")).toHaveTextContent(
        `${LONG_MESSAGE.slice(0, 40)}…`,
      );
    });
  });

  it("handles stream http errors, incomplete chunks and error events", async () => {
    installFetch({
      conversations: [],
      streamResponse: jsonResponse({ error: "bad key" }, false),
    });
    const firstRender = render(
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
      expect(screen.getByTestId("messages")).toHaveTextContent("Error: bad key");
    });
    firstRender.unmount();
    vi.unstubAllGlobals();

    installFetch({
      conversations: [],
      streamBody: 'event: delta\ndata: {"text":"partial"}',
    });
    const secondRender = render(
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
      expect(screen.getByTestId("thinking")).toHaveTextContent("false");
    });
    secondRender.unmount();
    vi.unstubAllGlobals();

    installFetch({
      conversations: [],
      streamBody: "data: {}\n\nevent: error\ndata: {}\n\n",
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
      expect(screen.getByTestId("thinking")).toHaveTextContent("false");
    });
  });

  it("uses the response status text when an error response has invalid JSON", async () => {
    installFetch({
      conversations: [],
      streamResponse: {
        ok: false,
        statusText: "Service Unavailable",
        json: vi.fn(async () => {
          throw new Error("invalid json");
        }),
      } as unknown as Response,
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
        "Error: Service Unavailable",
      );
    });
  });

  it("uses the response status text when an error payload has no message", async () => {
    installFetch({
      conversations: [],
      streamResponse: jsonResponse({}, false),
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
        "Error: Bad Request",
      );
    });
  });

  it("renders non-Error stream failures", async () => {
    installFetch({
      conversations: [],
      pendingStream: () => Promise.reject("network exploded"),
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
        "Error: network exploded",
      );
    });
  });

  it("stops processing completed SSE events when the stream is aborted", async () => {
    const encoder = new TextEncoder();
    let releaseFirstRead!: () => void;
    let readCount = 0;
    installFetch({
      conversations: [],
      streamResponse: {
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn(() => {
              readCount += 1;
              if (readCount === 1) {
                return new Promise((resolve) => {
                  releaseFirstRead = () =>
                    resolve({
                      done: false,
                      value: encoder.encode('event: delta\ndata: {"text":"late"}\n\n'),
                    });
                });
              }
              return Promise.resolve({ done: true, value: undefined });
            }),
          }),
        },
      } as unknown as Response,
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
      expect(screen.getByTestId("thinking")).toHaveTextContent("true");
      expect(releaseFirstRead).toBeTypeOf("function");
    });

    fireEvent.click(screen.getByText("abort"));
    await act(async () => {
      releaseFirstRead();
    });

    await waitFor(() => {
      expect(screen.getByTestId("thinking")).toHaveTextContent("false");
      expect(screen.getByTestId("messages")).not.toHaveTextContent("late");
    });
  });

  it("throws when useChat is rendered outside ChatProvider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<UnsafeChatProbe />)).toThrow(
      "useChat must be inside ChatProvider",
    );
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
