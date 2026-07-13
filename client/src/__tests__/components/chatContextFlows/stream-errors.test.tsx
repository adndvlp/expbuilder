import {
  ChatProbe,
  fetchMock,
  installFetch,
  jsonResponse,
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
import { ChatProvider } from "../../../contexts/ChatContext";

describe("ChatProvider flows", () => {
  registerChatproviderFlowsHooks();

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
      expect(screen.getByTestId("messages")).toHaveTextContent(
        "Error: bad key",
      );
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
                      value: encoder.encode(
                        'event: delta\ndata: {"text":"late"}\n\n',
                      ),
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
});
