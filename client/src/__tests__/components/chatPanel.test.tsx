import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ChatPanel from "../../components/Chat/ChatPanel";

const chatMock = vi.hoisted(() => ({
  state: {} as any,
}));

vi.mock("../../contexts/ChatContext", () => ({
  useChat: () => chatMock.state,
}));

vi.mock("../../components/Chat/ConversationList", () => ({
  default: () => <aside>History mock</aside>,
}));

vi.mock("../../components/Chat/ChatMessage", () => ({
  default: ({ message }: any) => (
    <article data-testid={`message-${message.id}`}>
      {message.role}:{message.content}
    </article>
  ),
}));

vi.mock("../../components/Chat/ChatInput", () => ({
  default: ({ showHints }: { showHints: boolean }) => (
    <div data-testid="chat-input">{String(showHints)}</div>
  ),
}));

vi.mock("../../components/Chat/ProviderPicker", () => ({
  ProviderBadge: ({ onOpen }: { onOpen: () => void }) => (
    <button type="button" onClick={onOpen}>
      Provider badge
    </button>
  ),
  ProviderView: ({ onClose }: { onClose: () => void }) => (
    <section>
      <span>Provider view mock</span>
      <button type="button" onClick={onClose}>
        Close providers
      </button>
    </section>
  ),
}));

function installChat(overrides: Record<string, unknown> = {}) {
  chatMock.state = {
    isOpen: true,
    close: vi.fn(),
    isThinking: false,
    activeConversation: { messages: [] },
    newConversation: vi.fn(),
    sendMessage: vi.fn(),
    ...overrides,
  };
  return chatMock.state;
}

describe("ChatPanel", () => {
  beforeEach(() => {
    installChat();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("renders the empty panel actions, hints, history and provider picker", () => {
    const chat = installChat();

    render(<ChatPanel />);

    fireEvent.click(screen.getByText("Create an image trial with 3 stimuli"));
    expect(chat.sendMessage).toHaveBeenCalledWith(
      "Create an image trial with 3 stimuli",
    );

    fireEvent.click(screen.getByTitle("History"));
    expect(screen.getByText("History mock")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("New conversation"));
    expect(chat.newConversation).toHaveBeenCalled();

    fireEvent.click(screen.getByText("Provider badge"));
    expect(screen.getByText("Provider view mock")).toBeInTheDocument();
    expect(screen.queryByTestId("chat-input")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Close providers"));
    expect(screen.getByTestId("chat-input")).toHaveTextContent("true");

    fireEvent.click(screen.getByTitle("Close"));
    expect(chat.close).toHaveBeenCalled();
  });

  it("renders messages, thinking state and thinking bubble branches", () => {
    installChat({
      isThinking: true,
      activeConversation: {
        messages: [{ id: "user-1", role: "user", content: "Build it" }],
      },
    });
    const { rerender } = render(<ChatPanel />);

    expect(screen.getByText(/Processing/)).toBeInTheDocument();
    expect(screen.getByTestId("message-user-1")).toHaveTextContent(
      "user:Build it",
    );
    expect(document.querySelector(".chat-thinking")).toBeInTheDocument();

    installChat({
      isThinking: false,
      activeConversation: {
        messages: [{ id: "assistant-1", role: "assistant", content: "Done" }],
      },
    });
    rerender(<ChatPanel />);
    expect(screen.getByTestId("message-assistant-1")).toHaveTextContent(
      "assistant:Done",
    );
    expect(document.querySelector(".chat-thinking")).not.toBeInTheDocument();

    installChat({
      isThinking: true,
      activeConversation: {
        messages: [{ id: "assistant-2", role: "assistant", content: "Working" }],
      },
    });
    rerender(<ChatPanel />);
    expect(screen.getByText(/Processing/)).toBeInTheDocument();
    expect(document.querySelector(".chat-thinking")).not.toBeInTheDocument();
  });

  it("runs the close animation, backdrop close and timeout cleanup", () => {
    vi.useFakeTimers();
    const chat = installChat();
    const { rerender } = render(<ChatPanel />);

    expect(document.querySelector(".chat-backdrop")).toBeInTheDocument();

    chatMock.state = { ...chatMock.state, isOpen: false };
    rerender(<ChatPanel />);
    const backdrop = document.querySelector(".chat-backdrop")!;
    expect(backdrop).toHaveClass("closing");

    fireEvent.click(backdrop);
    expect(chat.close).toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(260);
    });

    expect(document.querySelector(".chat-backdrop")).not.toBeInTheDocument();
  });

  it("handles unopened panels and missing active conversations", () => {
    installChat({ isOpen: false });
    const { rerender } = render(<ChatPanel />);
    expect(document.querySelector(".chat-panel")).not.toBeInTheDocument();

    installChat({ isOpen: true, activeConversation: null });
    rerender(<ChatPanel />);
    expect(screen.getByText("ExpBuilder Agent")).toBeInTheDocument();
  });
});
