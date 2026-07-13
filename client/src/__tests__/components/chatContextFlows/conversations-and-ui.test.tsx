import {
  ChatProbe,
  LONG_MESSAGE,
  UnsafeChatProbe,
  fetchMock,
  installFetch,
  registerChatproviderFlowsHooks,
  streamCallBody,
} from "./testHarness";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatProvider } from "../../../contexts/ChatContext";
import ChatFAB from "../../../components/Chat/ChatFAB";
import ChatPanel from "../../../components/Chat/ChatPanel";

describe("ChatProvider flows", () => {
  registerChatproviderFlowsHooks();

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
    expect(screen.getByTestId("active-title")).toHaveTextContent(
      "Renamed chat",
    );
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
