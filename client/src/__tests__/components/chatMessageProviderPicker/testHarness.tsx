import { afterEach, beforeEach, vi } from "vitest";

import { PROVIDERS } from "../../../components/Chat/providers";

import type { Message, ToolCall } from "../../../contexts/ChatContext";

const mocks = vi.hoisted(() => ({
  chatState: {} as any,
  providersState: {
    providers: [] as any[],
    loading: false,
  },
  setProviderAndModel: vi.fn(),
  setApiKey: vi.fn(),
}));

vi.mock("../../../contexts/ChatContext", () => ({
  useChat: () => mocks.chatState,
}));

vi.mock("../../../lib/useProviders", () => ({
  useProviders: () => mocks.providersState,
}));

vi.mock("react-markdown", () => ({
  default: ({ children, components }: any) => {
    const text = String(children);
    const fence = /```(\w+)\n([\s\S]*?)```/.exec(text);
    if (!components?.code) return <>{children}</>;

    const Code = components.code;
    if (!fence) {
      const inline = /`([^`]+)`/.exec(text);
      if (!inline) return <>{children}</>;
      return (
        <>
          {text.slice(0, inline.index)}
          <Code>{inline[1]}</Code>
          {text.slice(inline.index + inline[0].length)}
        </>
      );
    }

    return <Code className={`language-${fence[1]}`}>{fence[2]}</Code>;
  },
}));

vi.mock("react-syntax-highlighter", () => ({
  Prism: ({ children }: any) => (
    <pre data-testid="syntax-highlighter">{children}</pre>
  ),
}));

vi.mock("react-syntax-highlighter/dist/esm/styles/prism", () => ({
  vscDarkPlus: {},
}));

function provider(id: string) {
  const found = PROVIDERS.find((p) => p.id === id);
  if (!found) throw new Error(`Missing provider fixture: ${id}`);
  return found;
}

function message(overrides: Partial<Message>): Message {
  return {
    id: "msg-1",
    role: "assistant",
    content: "Hello",
    timestamp: new Date("2026-05-25T12:00:00.000Z"),
    ...overrides,
  };
}

function toolCall(overrides: Partial<ToolCall>): ToolCall {
  return {
    id: "tool-1",
    name: "updateTrial",
    args: {},
    status: "done",
    ...overrides,
  };
}

function installClipboard(writeText = vi.fn(async () => undefined)) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  return writeText;
}

const openai = provider("openai");

const anthropic = provider("anthropic");

const ollama = provider("ollama");

function registerChatProviderLookupHooks() {}

function registerChatmessageAndToolCallCardHooks() {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
}

function registerProviderpickerHooks() {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.chatState = {
      provider: openai,
      model: openai.models[0],
      setProviderAndModel: mocks.setProviderAndModel,
      apiKeys: { openai: " sk-openai " },
      setApiKey: mocks.setApiKey,
    };
    mocks.providersState = {
      providers: [anthropic, openai, provider("google"), ollama],
      loading: false,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
}

export {
  anthropic,
  installClipboard,
  message,
  mocks,
  ollama,
  openai,
  provider,
  registerChatProviderLookupHooks,
  registerChatmessageAndToolCallCardHooks,
  registerProviderpickerHooks,
  toolCall,
};
