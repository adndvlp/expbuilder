import { useEffect, useMemo, useRef, useState } from "react";
import { FiArrowLeft, FiLoader, FiSearch } from "react-icons/fi";
import { useChat } from "../../../contexts/ChatContext";
import { useProviders } from "../../../lib/useProviders";
import type { AIModel, ModelTier, Provider } from "../types/providers";
import { ProviderDetails } from "./ProviderDetails";
import { ProviderList } from "./ProviderList";
import { isConnected } from "./providerUtils";

const API_BASE = import.meta.env.VITE_API_URL;

interface LocalModelResponse {
  id: string;
  name?: string;
}

export function ProviderView({ onClose }: { onClose: () => void }) {
  const {
    provider: activeProvider,
    model: activeModel,
    setProviderAndModel,
    apiKeys,
    setApiKey,
  } = useChat();
  const { providers, loading } = useProviders();
  const [search, setSearch] = useState("");
  const [selectedProvider, setSelectedProvider] =
    useState<Provider>(activeProvider);
  const [showKey, setShowKey] = useState(false);
  const [keyDraft, setKeyDraft] = useState(apiKeys[activeProvider.id] ?? "");
  const searchRef = useRef<HTMLInputElement>(null);
  const [localModels, setLocalModels] = useState<AIModel[] | null>(null);
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [detectedLocals, setDetectedLocals] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!selectedProvider.local) {
      setLocalModels(null);
      setLocalError(null);
      return;
    }
    setLocalLoading(true);
    setLocalError(null);
    setLocalModels(null);
    fetch(`${API_BASE}/api/providers/${selectedProvider.id}/models`)
      .then((response) => response.json())
      .then((data: { error?: string; models?: LocalModelResponse[] }) => {
        if (data.error) throw new Error(data.error);
        const models: AIModel[] = (data.models || []).map((model) => ({
          id: model.id,
          name: model.name || model.id,
          shortName: model.name || model.id,
          contextK: 128,
          tier: "balanced" as ModelTier,
          description: "",
        }));
        setLocalModels(models);
        setDetectedLocals((previous) =>
          new Set(previous).add(selectedProvider.id),
        );
      })
      .catch((error) => {
        setLocalError(error.message);
        setDetectedLocals((previous) => {
          const next = new Set(previous);
          next.delete(selectedProvider.id);
          return next;
        });
      })
      .finally(() => setLocalLoading(false));
  }, [selectedProvider.id, selectedProvider.local]);

  useEffect(() => searchRef.current?.focus(), []);

  const { connected, others } = useMemo(() => {
    const query = search.toLowerCase();
    const filtered = providers.filter(
      (provider) =>
        !query ||
        provider.name.toLowerCase().includes(query) ||
        provider.models.some(
          (model) =>
            model.name.toLowerCase().includes(query) ||
            model.id.toLowerCase().includes(query),
        ),
    );
    const connectedProviders: Provider[] = [];
    const otherProviders: Provider[] = [];
    for (const provider of filtered) {
      const bucket =
        isConnected(provider, apiKeys) || detectedLocals.has(provider.id)
          ? connectedProviders
          : otherProviders;
      bucket.push(provider);
    }
    return { connected: connectedProviders, others: otherProviders };
  }, [search, apiKeys, providers, detectedLocals]);

  const availableModels = useMemo<AIModel[]>(() => {
    if (selectedProvider.local) return localModels ?? [];
    if (!isConnected(selectedProvider, apiKeys)) return [];
    const query = search.toLowerCase();
    if (!query) return selectedProvider.models;
    return selectedProvider.models.filter(
      (model) =>
        model.name.toLowerCase().includes(query) ||
        model.description.toLowerCase().includes(query),
    );
  }, [selectedProvider, apiKeys, search, localModels]);

  const selectProvider = (provider: Provider) => {
    setSelectedProvider(provider);
    setShowKey(false);
    setKeyDraft(apiKeys[provider.id] ?? "");
  };
  const selectModel = (model: AIModel) => {
    setProviderAndModel(selectedProvider.id, model.id);
    onClose();
  };
  const saveKey = () => setApiKey(selectedProvider.id, keyDraft.trim());

  return (
    <div className="pv-root">
      <div className="pv-topbar">
        <button className="pv-back" onClick={onClose}>
          <FiArrowLeft size={14} />
        </button>
        <div className="pv-search-wrap">
          <FiSearch size={12} className="pv-search-icon" />
          <input
            ref={searchRef}
            className="pv-search"
            placeholder="Search provider or model…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {search && (
            <button className="pv-search-clear" onClick={() => setSearch("")}>
              ×
            </button>
          )}
        </div>
      </div>
      <div className="pv-body">
        <div className="pv-left">
          {loading && providers.length === 0 && (
            <div className="pv-loading">
              <FiLoader size={14} className="pv-loading-spin" />
              <span>Loading providers…</span>
            </div>
          )}
          {connected.length > 0 && (
            <ProviderList
              label="Connected"
              providers={connected}
              selected={selectedProvider}
              active={activeProvider}
              apiKeys={apiKeys}
              onSelect={selectProvider}
            />
          )}
          {others.length > 0 && (
            <ProviderList
              label={
                connected.length ? "Available" : `Providers (${others.length})`
              }
              providers={others}
              selected={selectedProvider}
              active={activeProvider}
              apiKeys={apiKeys}
              onSelect={selectProvider}
            />
          )}
        </div>
        <ProviderDetails
          selectedProvider={selectedProvider}
          activeProvider={activeProvider}
          activeModel={activeModel}
          providerConnected={isConnected(selectedProvider, apiKeys)}
          localModels={localModels}
          localLoading={localLoading}
          localError={localError}
          availableModels={availableModels}
          keyDraft={keyDraft}
          showKey={showKey}
          onKeyDraftChange={setKeyDraft}
          onToggleKey={() => setShowKey((visible) => !visible)}
          onSaveKey={saveKey}
          onSelectModel={selectModel}
        />
      </div>
    </div>
  );
}
