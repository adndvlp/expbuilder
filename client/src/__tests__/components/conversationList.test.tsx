import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ConversationList from "../../components/Chat/ConversationList";
import type { Conversation } from "../../contexts/ChatContext";

const mocks = vi.hoisted(() => ({
  chatState: {} as any,
  newConversation: vi.fn(),
  selectConversation: vi.fn(),
  deleteConversation: vi.fn(),
  renameConversation: vi.fn(),
}));

vi.mock("../../contexts/ChatContext", () => ({
  useChat: () => mocks.chatState,
}));

function conv(id: string, title: string, updatedAt: string): Conversation {
  return {
    id,
    title,
    messages: [],
    createdAt: new Date(updatedAt),
    updatedAt: new Date(updatedAt),
  };
}

describe("ConversationList", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-25T12:00:00.000Z"));
    vi.clearAllMocks();
    mocks.chatState = {
      conversations: [],
      activeConvId: null,
      newConversation: mocks.newConversation,
      selectConversation: mocks.selectConversation,
      deleteConversation: mocks.deleteConversation,
      renameConversation: mocks.renameConversation,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders the empty state and starts a new conversation", () => {
    render(<ConversationList />);

    expect(screen.getByText("Conversations")).toBeInTheDocument();
    expect(
      screen.getByText("No conversations yet. Start chatting with the agent."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("New conversation"));

    expect(mocks.newConversation).toHaveBeenCalledTimes(1);
  });

  it("groups conversations by recency and selects the active item", () => {
    mocks.chatState = {
      ...mocks.chatState,
      activeConvId: "today",
      conversations: [
        conv("today", "Today chat", "2026-05-25T08:00:00.000Z"),
        conv("today-2", "Second today chat", "2026-05-25T07:00:00.000Z"),
        conv("yesterday", "Yesterday chat", "2026-05-24T08:00:00.000Z"),
        conv("week", "Week chat", "2026-05-22T08:00:00.000Z"),
        conv("earlier", "Earlier chat", "2026-05-01T08:00:00.000Z"),
      ],
    };

    render(<ConversationList />);

    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Second today chat")).toBeInTheDocument();
    expect(screen.getByText("Yesterday")).toBeInTheDocument();
    expect(screen.getByText("This week")).toBeInTheDocument();
    expect(screen.getByText("Earlier")).toBeInTheDocument();
    expect(screen.getByText("Today chat").closest(".chat-conv-item")).toHaveClass("active");

    fireEvent.click(screen.getByText("Yesterday chat"));

    expect(mocks.selectConversation).toHaveBeenCalledWith("yesterday");
  });

  it("deletes without selecting and commits trimmed renames with Enter", () => {
    mocks.chatState = {
      ...mocks.chatState,
      activeConvId: "today",
      conversations: [
        conv("today", "Today chat", "2026-05-25T08:00:00.000Z"),
        conv("yesterday", "Yesterday chat", "2026-05-24T08:00:00.000Z"),
      ],
    };

    render(<ConversationList />);

    fireEvent.click(screen.getAllByTitle("Delete")[0]);

    expect(mocks.deleteConversation).toHaveBeenCalledWith("today");
    expect(mocks.selectConversation).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByTitle("Rename")[0]);
    act(() => {
      vi.advanceTimersByTime(0);
    });

    const input = screen.getByDisplayValue("Today chat");
    fireEvent.click(input);
    expect(mocks.selectConversation).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "  Renamed today  " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mocks.renameConversation).toHaveBeenCalledWith("today", "Renamed today");
  });

  it("cancels rename with Escape and ignores unchanged titles on blur", () => {
    mocks.chatState = {
      ...mocks.chatState,
      conversations: [conv("today", "Today chat", "2026-05-25T08:00:00.000Z")],
    };

    const { rerender } = render(<ConversationList />);

    fireEvent.click(screen.getByTitle("Rename"));
    fireEvent.change(screen.getByDisplayValue("Today chat"), {
      target: { value: "Should not save" },
    });
    fireEvent.keyDown(screen.getByDisplayValue("Should not save"), { key: "Escape" });

    expect(mocks.renameConversation).not.toHaveBeenCalled();
    expect(screen.getByText("Today chat")).toBeInTheDocument();

    rerender(<ConversationList />);
    fireEvent.click(screen.getByTitle("Rename"));
    fireEvent.blur(screen.getByDisplayValue("Today chat"));

    expect(mocks.renameConversation).not.toHaveBeenCalled();
  });
});
