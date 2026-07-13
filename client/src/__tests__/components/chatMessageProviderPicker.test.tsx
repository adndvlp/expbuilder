import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ChatMessage from "../../components/Chat/ChatMessage";
import ToolCallCard from "../../components/Chat/ToolCallCard";
import { ProviderBadge, ProviderView } from "../../components/Chat/ProviderPicker";
import {
  DEFAULT_PROVIDER,
  PROVIDERS,
  findModel,
  findProvider,
} from "../../components/Chat/providers";
import type { Message, ToolCall } from "../../contexts/ChatContext";

const mocks = vi.hoisted(() => ({
  chatState: {} as any,
  providersState: {
    providers: [] as any[],
    loading: false,
  },
  setProviderAndModel: vi.fn(),
  setApiKey: vi.fn(),
}));

vi.mock("../../contexts/ChatContext", () => ({
  useChat: () => mocks.chatState,
}));

vi.mock("../../lib/useProviders", () => ({
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

    return (
      <Code className={`language-${fence[1]}`}>
        {fence[2]}
      </Code>
    );
  },
}));

vi.mock("react-syntax-highlighter", () => ({
  Prism: ({ children }: any) => <pre data-testid="syntax-highlighter">{children}</pre>,
}));

vi.mock("react-syntax-highlighter/dist/esm/styles/prism", () => ({
  vscDarkPlus: {},
}));

function provider(id: string) {
  const found = PROVIDERS.find((p) => p.id === id);
  if (!found) throw new Error(`Missing provider fixture: ${id}`);
  return found;
}

describe("chat provider lookup", () => {
  it("falls back to the default provider and its first model", () => {
    expect(findProvider("missing-provider")).toBe(DEFAULT_PROVIDER);
    expect(findModel(DEFAULT_PROVIDER, "missing-model")).toBe(
      DEFAULT_PROVIDER.models[0],
    );
  });
});

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

describe("ChatMessage and ToolCallCard", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

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
    expect(screen.getByAltText("stimulus.png")).toHaveAttribute("src", "blob:image");
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
    expect(screen.getByTestId("syntax-highlighter")).toHaveTextContent("const ok = true;");

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

describe("ProviderPicker", () => {
  const openai = provider("openai");
  const anthropic = provider("anthropic");
  const ollama = provider("ollama");

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

  it("renders the active provider badge and opens the picker", () => {
    const onOpen = vi.fn();

    render(<ProviderBadge onOpen={onOpen} />);

    expect(screen.getByText("OpenAI")).toBeInTheDocument();
    expect(screen.getByText("GPT-4o")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button"));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("filters available models and selects a model for the active provider", () => {
    const onClose = vi.fn();

    render(<ProviderView onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText("Search provider or model…"), {
      target: { value: "mini" },
    });
    fireEvent.click(screen.getByText("GPT-4o mini"));

    expect(mocks.setProviderAndModel).toHaveBeenCalledWith("openai", "gpt-4o-mini");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("selects another provider and saves a trimmed API key", () => {
    render(<ProviderView onClose={vi.fn()} />);

    const search = screen.getByPlaceholderText("Search provider or model…");
    fireEvent.change(search, { target: { value: "claude" } });
    fireEvent.click(screen.getByText("×"));
    expect(search).toHaveValue("");

    fireEvent.click(screen.getByText("Anthropic"));

    expect(screen.getByText("No API key")).toBeInTheDocument();
    expect(
      screen.getByText("Set your API key to see available models for Anthropic."),
    ).toBeInTheDocument();

    const input = screen.getByPlaceholderText("sk-ant-api03-…");
    fireEvent.change(input, { target: { value: "  sk-ant-new  " } });
    fireEvent.click(document.querySelector(".pv-key-btn")!);
    expect(input).toHaveAttribute("type", "text");
    fireEvent.blur(input);
    expect(mocks.setApiKey).toHaveBeenCalledWith("anthropic", "sk-ant-new");
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.click(document.querySelector(".pv-key-btn.save")!);

    expect(mocks.setApiKey).toHaveBeenCalledWith("anthropic", "sk-ant-new");
  });

  it("loads local provider models and selects one without requiring an API key", async () => {
    const onClose = vi.fn();
    const localModel = {
      id: "llama3.1",
      name: "Llama 3.1",
      shortName: "Llama 3.1",
      contextK: 128,
      tier: "balanced",
      description: "",
    };
    const secondLocalModel = {
      id: "mistral-local",
      name: "Mistral Local",
      shortName: "Mistral Local",
      contextK: 128,
      tier: "balanced",
      description: "",
    };

    mocks.chatState = {
      ...mocks.chatState,
      provider: ollama,
      model: localModel,
      apiKeys: {},
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: vi.fn(async () => ({
          models: [
            { id: "llama3.1", name: "Llama 3.1" },
            { id: "mistral-local", name: "Mistral Local" },
          ],
        })),
      })),
    );

    render(<ProviderView onClose={onClose} />);

    expect(await screen.findByText("Llama 3.1")).toBeInTheDocument();
    expect(screen.getByText("Mistral Local")).toBeInTheDocument();
    expect(screen.getByText("2 models")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Mistral Local"));

    expect(fetch).toHaveBeenCalledWith("http://localhost:3000/api/providers/ollama/models");
    expect(mocks.setProviderAndModel).toHaveBeenCalledWith("ollama", secondLocalModel.id);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders provider loading, connected non-active providers and one-model labels", () => {
    mocks.providersState = { providers: [], loading: true };
    const { unmount } = render(<ProviderView onClose={vi.fn()} />);

    expect(screen.getByText("Loading providers…")).toBeInTheDocument();
    unmount();

    const oneModelProvider = {
      ...openai,
      id: "single-provider",
      name: "Single Provider",
      keyPlaceholder: undefined,
      models: [
        {
          ...openai.models[0],
          id: "single-model",
          name: "Only Model",
          shortName: "Only",
        },
      ],
    };
    mocks.chatState = {
      ...mocks.chatState,
      provider: oneModelProvider,
      model: oneModelProvider.models[0],
      apiKeys: { "single-provider": "single-key", anthropic: "ant-key" },
    };
    mocks.providersState = {
      providers: [oneModelProvider, anthropic],
      loading: false,
    };
    render(<ProviderView onClose={vi.fn()} />);

    expect(screen.getByPlaceholderText("API key…")).toBeInTheDocument();
    expect(screen.getAllByText("1 model").length).toBeGreaterThan(0);
    expect(document.querySelector(".pv-dot.teal")).toBeInTheDocument();
  });

  it("renders local provider error and empty-model states", async () => {
    mocks.chatState = {
      ...mocks.chatState,
      provider: ollama,
      model: { id: "none", name: "None", shortName: "None" },
      apiKeys: {},
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: vi.fn(async () => ({ error: "Ollama offline" })),
      })),
    );

    const { unmount } = render(<ProviderView onClose={vi.fn()} />);

    expect(await screen.findByText("Could not connect to Ollama.")).toBeInTheDocument();
    expect(screen.getAllByText("Ollama offline").length).toBeGreaterThan(0);
    unmount();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: vi.fn(async () => ({})),
      })),
    );
    render(<ProviderView onClose={vi.fn()} />);

    expect(await screen.findByText("No models found in Ollama.")).toBeInTheDocument();
  });

  it("falls back to local model ids when names are missing", async () => {
    mocks.chatState = {
      ...mocks.chatState,
      provider: ollama,
      model: { id: "other", name: "Other", shortName: "Other" },
      apiKeys: {},
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: vi.fn(async () => ({ models: [{ id: "bare-model" }] })),
      })),
    );

    render(<ProviderView onClose={vi.fn()} />);

    expect(await screen.findByText("bare-model")).toBeInTheDocument();
    expect(screen.getAllByText("1 model").length).toBeGreaterThan(0);
  });
});
