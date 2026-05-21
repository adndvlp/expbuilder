import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  ReactNode,
} from "react";
import {
  type Provider,
  type AIModel,
  DEFAULT_PROVIDER,
  DEFAULT_MODEL,
  findProvider as findStaticProvider,
  findModel,
} from "../components/Chat/providers";
import { findCatalogProvider, prefetchProviders, loadProviders } from "../lib/providerCatalog";

const API_BASE = "http://localhost:3000";

export interface Attachment {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number;
  file?: File;
}

export interface ToolCall {
  id: string;
  name: string;
  description?: string;
  args: Record<string, unknown>;
  result?: string;
  error?: string;
  status: "pending" | "running" | "done" | "error";
  durationMs?: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  attachments?: Attachment[];
  timestamp: Date;
  isStreaming?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

interface ChatContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  conversations: Conversation[];
  activeConvId: string | null;
  activeConversation: Conversation | null;
  newConversation: () => void;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  sendMessage: (content: string, attachments?: Attachment[]) => void;
  isThinking: boolean;
  abortStream: () => void;
  // Provider / model selection
  provider: Provider;
  model: AIModel;
  setProviderAndModel: (providerId: string, modelId: string) => void;
  apiKeys: Record<string, string>;
  setApiKey: (providerId: string, key: string) => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

const uid = () => Math.random().toString(36).slice(2, 10);

/** Parse a single SSE line pair into { event, data } */
function parseSSEChunk(chunk: string): Array<{ event: string; data: string }> {
  const events: Array<{ event: string; data: string }> = [];
  const blocks = chunk.split("\n\n");
  for (const block of blocks) {
    if (!block.trim()) continue;
    let event = "message";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event: ")) event = line.slice(7).trim();
      else if (line.startsWith("data: ")) data = line.slice(6).trim();
    }
    if (data) events.push({ event, data });
  }
  return events;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const loadedRef = useRef(false); // skip persist before initial load completes

  // Provider / model state
  const [provider, setProvider] = useState<Provider>(DEFAULT_PROVIDER);
  const [model, setModel] = useState<AIModel>(DEFAULT_MODEL);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});

  // ── Persistence ────────────────────────────────────────

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const convTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved state on mount + prefetch provider catalog
  useEffect(() => {
    prefetchProviders();
    Promise.all([
      fetch(`${API_BASE}/api/chat/settings`).then((r) => r.json()),
      fetch(`${API_BASE}/api/chat/conversations`).then((r) => r.json()),
    ])
      .then(async ([settings, convs]) => {
        if (settings.apiKeys) setApiKeys(settings.apiKeys);
        if (settings.activeProvider && settings.activeModel) {
          // Wait for catalog to finish loading so findCatalogProvider works
          await loadProviders();
          const p =
            findCatalogProvider(settings.activeProvider) ??
            findStaticProvider(settings.activeProvider);
          const m = findModel(p, settings.activeModel);
          setProvider(p);
          setModel(m);
        }
        if (Array.isArray(convs) && convs.length > 0) {
          // Revive Date strings → Date objects
          const revived = convs.map((c: Conversation) => ({
            ...c,
            createdAt: new Date(c.createdAt),
            updatedAt: new Date(c.updatedAt),
            messages: c.messages.map((m) => ({
              ...m,
              timestamp: new Date(m.timestamp),
            })),
          }));
          setConversations(revived);
          setActiveConvId(revived[0]?.id ?? null);
        }
      })
      .catch(() => {})
      .finally(() => { loadedRef.current = true; });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced save: settings (apiKeys, provider, model)
  const persistSettings = useCallback(
    (newApiKeys: Record<string, string>, providerId: string, modelId: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        fetch(`${API_BASE}/api/chat/settings`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKeys: newApiKeys,
            activeProvider: providerId,
            activeModel: modelId,
          }),
        }).catch(() => {});
      }, 500);
    },
    []
  );

  // Debounced save: conversations (1s delay — avoids hammering on stream)
  const persistConversations = useCallback((convs: Conversation[]) => {
    if (convTimerRef.current) clearTimeout(convTimerRef.current);
    convTimerRef.current = setTimeout(() => {
      fetch(`${API_BASE}/api/chat/conversations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(convs),
      }).catch(() => {});
    }, 1000);
  }, []);

  // Persist conversations whenever they change (after initial load)
  useEffect(() => {
    if (!loadedRef.current) return;
    persistConversations(conversations);
  }, [conversations, persistConversations]);

  // ── State setters with persistence ─────────────────────

  const setProviderAndModel = useCallback(
    (providerId: string, modelId: string) => {
      const p = findCatalogProvider(providerId) ?? findStaticProvider(providerId);
      const m = findModel(p, modelId);
      setProvider(p);
      setModel(m);
      persistSettings(apiKeys, providerId, modelId);
    },
    [apiKeys, persistSettings]
  );

  const setApiKey = useCallback(
    (providerId: string, key: string) => {
      setApiKeys((prev) => {
        const next = { ...prev, [providerId]: key };
        persistSettings(next, provider.id, model.id);
        return next;
      });
    },
    [provider.id, model.id, persistSettings]
  );

  const activeConversation =
    conversations.find((c) => c.id === activeConvId) ?? null;

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  const newConversation = useCallback(() => {
    setConversations((prev) => {
      const active = prev.find((c) => c.id === activeConvId);
      if (active && active.messages.length === 0) {
        // Active conversation already empty — reuse it, don't create another
        return prev;
      }
      const conv: Conversation = {
        id: uid(),
        title: "New conversation",
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setActiveConvId(conv.id);
      return [conv, ...prev];
    });
  }, [activeConvId]);

  const selectConversation = useCallback((id: string) => {
    setActiveConvId(id);
  }, []);

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConvId === id) {
        setActiveConvId(null);
      }
    },
    [activeConvId]
  );

  const renameConversation = useCallback((id: string, title: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title, updatedAt: new Date() } : c))
    );
  }, []);

  const abortStream = useCallback(() => {
    abortRef.current?.abort();
    setIsThinking(false);
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id !== activeConvId
          ? conv
          : {
              ...conv,
              messages: conv.messages.map((m) =>
                m.isStreaming ? { ...m, isStreaming: false } : m
              ),
            }
      )
    );
  }, [activeConvId]);

  const sendMessage = useCallback(
    (content: string, attachments?: Attachment[]) => {
      if (!content.trim() || isThinking) return;

      let convId = activeConvId;

      if (!convId) {
        const conv: Conversation = {
          id: uid(),
          title: content.slice(0, 40) + (content.length > 40 ? "…" : ""),
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setConversations((prev) => [conv, ...prev]);
        setActiveConvId(conv.id);
        convId = conv.id;
      }

      const userMsg: Message = {
        id: uid(),
        role: "user",
        content,
        attachments,
        timestamp: new Date(),
      };

      const updateConv = (updater: (conv: Conversation) => Conversation) => {
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? updater(c) : c))
        );
      };

      // Snapshot current messages before state update for API payload
      let historyMessages: { role: string; content: string }[] = [];
      setConversations((prev) => {
        const conv = prev.find((c) => c.id === convId);
        historyMessages = (conv?.messages ?? []).map((m) => ({
          role: m.role,
          content: m.content,
        }));
        return prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                messages: [...c.messages, userMsg],
                title:
                  c.messages.length === 0
                    ? content.slice(0, 40) + (content.length > 40 ? "…" : "")
                    : c.title,
                updatedAt: new Date(),
              }
            : c
        );
      });

      setIsThinking(true);
      const controller = new AbortController();
      abortRef.current = controller;

      const assistantId = uid();
      const assistantMsg: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        toolCalls: [],
        timestamp: new Date(),
        isStreaming: true,
      };

      updateConv((c) => ({
        ...c,
        messages: [...c.messages, assistantMsg],
        updatedAt: new Date(),
      }));

      const apiMessages = [
        ...historyMessages,
        { role: "user", content },
      ];

      (async () => {
        try {
          const res = await fetch(`${API_BASE}/api/chat/stream`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              providerId: provider.id,
              modelId: model.id,
              apiKey: apiKeys[provider.id] ?? undefined,
              messages: apiMessages,
            }),
            signal: controller.signal,
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(err.error ?? res.statusText);
          }

          const reader = res.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            // Split BEFORE parsing — only process complete \n\n-terminated blocks
            const lastDouble = buffer.lastIndexOf("\n\n");
            if (lastDouble < 0) continue;
            const complete = buffer.slice(0, lastDouble + 2);
            buffer = buffer.slice(lastDouble + 2);
            const events = parseSSEChunk(complete);

            for (const { event, data } of events) {
              if (controller.signal.aborted) break;
              if (event === "delta") {
                const { text } = JSON.parse(data);
                updateConv((c) => ({
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + text }
                      : m
                  ),
                }));
              } else if (event === "done" || event === "error") {
                break;
              }
            }
          }
        } catch (err: unknown) {
          if ((err as Error).name === "AbortError") return;
          const msg = err instanceof Error ? err.message : String(err);
          updateConv((c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.id === assistantId
                ? { ...m, content: `Error: ${msg}`, isStreaming: false }
                : m
            ),
          }));
        } finally {
          if (!controller.signal.aborted) {
            updateConv((c) => ({
              ...c,
              messages: c.messages.map((m) =>
                m.id === assistantId ? { ...m, isStreaming: false } : m
              ),
            }));
            setIsThinking(false);
          }
        }
      })();
    },
    [activeConvId, isThinking, provider, model, apiKeys]
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
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be inside ChatProvider");
  return ctx;
}
