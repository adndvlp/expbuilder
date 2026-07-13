import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  findModel,
  findProvider as findStaticProvider,
  type AIModel,
  type Provider,
} from "../../../components/Chat/providers";
import {
  findCatalogProvider,
  loadProviders,
  prefetchProviders,
} from "../../../lib/providerCatalog";
import type { Conversation } from "../types";

const API_BASE = import.meta.env.VITE_API_URL;

interface PersistenceOptions {
  conversations: Conversation[];
  setConversations: Dispatch<SetStateAction<Conversation[]>>;
  setActiveConvId: Dispatch<SetStateAction<string | null>>;
}

export function useChatPersistence({
  conversations,
  setConversations,
  setActiveConvId,
}: PersistenceOptions) {
  const [provider, setProvider] = useState<Provider>(DEFAULT_PROVIDER);
  const [model, setModel] = useState<AIModel>(DEFAULT_MODEL);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const loadedRef = useRef(false);
  const settingsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conversationsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    prefetchProviders();
    Promise.all([
      fetch(`${API_BASE}/api/chat/settings`).then((response) =>
        response.json(),
      ),
      fetch(`${API_BASE}/api/chat/conversations`).then((response) =>
        response.json(),
      ),
    ])
      .then(async ([settings, savedConversations]) => {
        if (settings.apiKeys) setApiKeys(settings.apiKeys);
        if (settings.activeProvider && settings.activeModel) {
          await loadProviders();
          const savedProvider =
            findCatalogProvider(settings.activeProvider) ??
            findStaticProvider(settings.activeProvider);
          setProvider(savedProvider);
          setModel(findModel(savedProvider, settings.activeModel));
        }
        if (
          Array.isArray(savedConversations) &&
          savedConversations.length > 0
        ) {
          const revived = savedConversations.map(
            (conversation: Conversation) => ({
              ...conversation,
              createdAt: new Date(conversation.createdAt),
              updatedAt: new Date(conversation.updatedAt),
              messages: conversation.messages.map((message) => ({
                ...message,
                timestamp: new Date(message.timestamp),
              })),
            }),
          );
          setConversations(revived);
          setActiveConvId(revived[0]!.id);
        }
      })
      .catch(() => {})
      .finally(() => {
        loadedRef.current = true;
      });
  }, [setActiveConvId, setConversations]);

  const persistSettings = useCallback(
    (keys: Record<string, string>, providerId: string, modelId: string) => {
      if (settingsTimerRef.current) clearTimeout(settingsTimerRef.current);
      settingsTimerRef.current = setTimeout(() => {
        fetch(`${API_BASE}/api/chat/settings`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKeys: keys,
            activeProvider: providerId,
            activeModel: modelId,
          }),
        }).catch(() => {});
      }, 500);
    },
    [],
  );

  const persistConversations = useCallback((next: Conversation[]) => {
    if (conversationsTimerRef.current) {
      clearTimeout(conversationsTimerRef.current);
    }
    conversationsTimerRef.current = setTimeout(() => {
      fetch(`${API_BASE}/api/chat/conversations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      }).catch(() => {});
    }, 1000);
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    persistConversations(conversations);
  }, [conversations, persistConversations]);

  const setProviderAndModel = useCallback(
    (providerId: string, modelId: string) => {
      const nextProvider =
        findCatalogProvider(providerId) ?? findStaticProvider(providerId);
      const nextModel = findModel(nextProvider, modelId);
      setProvider(nextProvider);
      setModel(nextModel);
      persistSettings(apiKeys, providerId, modelId);
    },
    [apiKeys, persistSettings],
  );

  const setApiKey = useCallback(
    (providerId: string, key: string) => {
      setApiKeys((previous) => {
        const next = { ...previous, [providerId]: key };
        persistSettings(next, provider.id, model.id);
        return next;
      });
    },
    [provider.id, model.id, persistSettings],
  );

  return {
    provider,
    model,
    apiKeys,
    setProviderAndModel,
    setApiKey,
  };
}
