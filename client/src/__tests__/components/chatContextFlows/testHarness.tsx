import { cleanup } from "@testing-library/react";

import { afterEach, beforeEach, expect, vi } from "vitest";

import { useChat } from "../../../contexts/ChatContext";

const catalogMocks = vi.hoisted(() => ({
  prefetchProviders: vi.fn(),
  loadProviders: vi.fn(async () => []),
  findCatalogProvider: vi.fn(() => undefined),
}));

const LONG_MESSAGE =
  "Build a complete experiment with enough detail to require a shortened title";

vi.mock("../../../lib/providerCatalog", () => ({
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
        return streamResponse(
          options?.streamBody ?? "event: done\ndata: {}\n\n",
        );
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
      <div data-testid="active-title">
        {chat.activeConversation?.title ?? "none"}
      </div>
      <div data-testid="active-id">{chat.activeConvId ?? "none"}</div>
      <div data-testid="conversation-count">{chat.conversations.length}</div>
      <div data-testid="messages">
        {messages
          .map(
            (msg) =>
              `${msg.role}|${msg.content}|${msg.reasoning ?? ""}|${String(
                msg.isStreaming,
              )}`,
          )
          .join("\n")}
      </div>
      <button onClick={chat.open}>open</button>
      <button onClick={chat.close}>close</button>
      <button onClick={chat.toggle}>toggle</button>
      <button onClick={chat.newConversation}>new conversation</button>
      <button onClick={() => chat.selectConversation("conv-1")}>
        select conv one
      </button>
      <button onClick={() => chat.deleteConversation("conv-1")}>
        delete conv one
      </button>
      <button onClick={() => chat.deleteConversation("missing")}>
        delete missing
      </button>
      <button onClick={() => chat.renameConversation("conv-1", "Renamed chat")}>
        rename
      </button>
      <button onClick={() => chat.setApiKey("openai", "sk-new")}>
        set key
      </button>
      <button
        onClick={() => chat.setProviderAndModel("google", "gemini-2.0-flash")}
      >
        set provider
      </button>
      <button onClick={() => chat.sendMessage("   ")}>send blank</button>
      <button onClick={() => chat.sendMessage("Build this experiment")}>
        send
      </button>
      <button onClick={() => chat.sendMessage("Second request")}>
        send second
      </button>
      <button onClick={() => chat.sendMessage(LONG_MESSAGE)}>send long</button>
      <button onClick={chat.abortStream}>abort</button>
    </div>
  );
}

function UnsafeChatProbe() {
  useChat();
  return null;
}

function registerChatproviderFlowsHooks() {
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
}

export {
  ChatProbe,
  LONG_MESSAGE,
  UnsafeChatProbe,
  catalogMocks,
  fetchMock,
  installFetch,
  jsonResponse,
  patchCalls,
  putCalls,
  registerChatproviderFlowsHooks,
  streamCallBody,
  streamResponse,
};
