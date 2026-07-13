import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { streamChat } from "./chat/services/streamChat";
import type {
  Attachment,
  ChatContextType,
  Conversation,
  Message,
} from "./chat/types";
import { useChatPersistence } from "./chat/hooks/useChatPersistence";

export type {
  Attachment,
  ChatContextType,
  Conversation,
  Message,
  ToolCall,
} from "./chat/types";
export { parseSSEChunk } from "./chat/utils/sse";

const ChatContext = createContext<ChatContextType | null>(null);
const uid = () => Math.random().toString(36).slice(2, 10);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { provider, model, apiKeys, setProviderAndModel, setApiKey } =
    useChatPersistence({
      conversations,
      setConversations,
      setActiveConvId,
    });

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeConvId) ??
    null;
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((visible) => !visible), []);

  const newConversation = useCallback(() => {
    setConversations((previous) => {
      const active = previous.find(
        (conversation) => conversation.id === activeConvId,
      );
      if (active && active.messages.length === 0) return previous;
      const conversation: Conversation = {
        id: uid(),
        title: "New conversation",
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setActiveConvId(conversation.id);
      return [conversation, ...previous];
    });
  }, [activeConvId]);

  const selectConversation = useCallback((id: string) => {
    setActiveConvId(id);
  }, []);

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((previous) =>
        previous.filter((conversation) => conversation.id !== id),
      );
      if (activeConvId === id) setActiveConvId(null);
    },
    [activeConvId],
  );

  const renameConversation = useCallback((id: string, title: string) => {
    setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id === id
          ? { ...conversation, title, updatedAt: new Date() }
          : conversation,
      ),
    );
  }, []);

  const abortStream = useCallback(() => {
    abortRef.current?.abort();
    setIsThinking(false);
    setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id !== activeConvId
          ? conversation
          : {
              ...conversation,
              messages: conversation.messages.map((message) =>
                message.isStreaming
                  ? { ...message, isStreaming: false }
                  : message,
              ),
            },
      ),
    );
  }, [activeConvId]);

  const sendMessage = useCallback(
    (content: string, attachments?: Attachment[]) => {
      if (!content.trim() || isThinking) return;
      let conversationId = activeConvId;

      if (!conversationId) {
        const conversation: Conversation = {
          id: uid(),
          title: content.slice(0, 40) + (content.length > 40 ? "…" : ""),
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setConversations((previous) => [conversation, ...previous]);
        setActiveConvId(conversation.id);
        conversationId = conversation.id;
      }

      const userMessage: Message = {
        id: uid(),
        role: "user",
        content,
        attachments,
        timestamp: new Date(),
      };
      const updateConversation = (
        updater: (conversation: Conversation) => Conversation,
      ) => {
        setConversations((previous) =>
          previous.map((conversation) =>
            conversation.id === conversationId
              ? updater(conversation)
              : conversation,
          ),
        );
      };
      const currentConversation = conversations.find(
        (conversation) => conversation.id === conversationId,
      );
      const historyMessages = (currentConversation?.messages ?? []).map(
        (message) => ({ role: message.role, content: message.content }),
      );

      setConversations((previous) =>
        previous.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                messages: [...conversation.messages, userMessage],
                title:
                  conversation.messages.length === 0
                    ? content.slice(0, 40) + (content.length > 40 ? "…" : "")
                    : conversation.title,
                updatedAt: new Date(),
              }
            : conversation,
        ),
      );

      setIsThinking(true);
      const controller = new AbortController();
      abortRef.current = controller;
      const assistantId = uid();
      const assistantMessage: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        toolCalls: [],
        timestamp: new Date(),
        isStreaming: true,
      };
      updateConversation((conversation) => ({
        ...conversation,
        messages: [...conversation.messages, assistantMessage],
        updatedAt: new Date(),
      }));

      void streamChat({
        providerId: provider.id,
        modelId: model.id,
        apiKey: apiKeys[provider.id] ?? undefined,
        messages: [...historyMessages, { role: "user", content }],
        signal: controller.signal,
        onDelta: ({ content: nextContent, reasoning }) => {
          updateConversation((conversation) => ({
            ...conversation,
            messages: conversation.messages.map((message) =>
              message.id === assistantId
                ? { ...message, reasoning, content: nextContent }
                : message,
            ),
          }));
        },
      })
        .catch((error: unknown) => {
          if ((error as Error).name === "AbortError") return;
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          updateConversation((conversation) => ({
            ...conversation,
            messages: conversation.messages.map((message) =>
              message.id === assistantId
                ? {
                    ...message,
                    content: `Error: ${errorMessage}`,
                    isStreaming: false,
                  }
                : message,
            ),
          }));
        })
        .finally(() => {
          if (controller.signal.aborted) return;
          updateConversation((conversation) => ({
            ...conversation,
            messages: conversation.messages.map((message) =>
              message.id === assistantId
                ? { ...message, isStreaming: false }
                : message,
            ),
          }));
          setIsThinking(false);
        });
    },
    [activeConvId, conversations, isThinking, provider, model, apiKeys],
  );

  return (
    <ChatContext.Provider
      value={{
        isOpen,
        open,
        close,
        toggle,
        conversations,
        activeConvId,
        activeConversation,
        newConversation,
        selectConversation,
        deleteConversation,
        renameConversation,
        sendMessage,
        isThinking,
        abortStream,
        provider,
        model,
        setProviderAndModel,
        apiKeys,
        setApiKey,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChat must be inside ChatProvider");
  return context;
}
