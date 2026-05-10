import { useState, useRef, useEffect, useMemo } from "react";
import { useChat } from "../../contexts/ChatContext";
import {
  TIER_LABELS,
  TIER_COLORS,
  type Provider,
  type AIModel,
} from "./providers";
import { useProviders } from "../../lib/useProviders";
import {
  FiChevronDown,
  FiKey,
  FiEye,
  FiEyeOff,
  FiCheck,
  FiSearch,
  FiPlus,
  FiArrowLeft,
  FiLoader,
} from "react-icons/fi";

function isConnected(p: Provider, apiKeys: Record<string, string>) {
  return p.local || !!apiKeys[p.id]?.trim();
}

/* ── Badge (header trigger) ───────────────────────────── */

interface BadgeProps {
  onOpen: () => void;
}

export function ProviderBadge({ onOpen }: BadgeProps) {
  const { provider, model } = useChat();
  const { Icon, color } = provider;

  return (
    <button
      className="provider-badge"
      onClick={onOpen}
      style={{ "--p-color": color } as React.CSSProperties}
    >
      <span className="provider-badge-icon">
        <Icon size={12} />
      </span>
      <span className="provider-badge-name">{provider.name}</span>
      <span className="provider-badge-sep">·</span>
      <span className="provider-badge-model">{model.shortName}</span>
      <FiChevronDown size={10} className="provider-badge-chevron" />
    </button>
  );
}

/* ── Full-panel provider view ─────────────────────────── */

interface ViewProps {
  onClose: () => void;
}

export function ProviderView({ onClose }: ViewProps) {
  const {
    provider: activeProvider,
    model: activeModel,
    setProviderAndModel,
    apiKeys,
    setApiKey,
  } = useChat();

  const { providers, loading } = useProviders();

  const [search, setSearch] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<Provider>(activeProvider);
  const [showKey, setShowKey] = useState(false);
  const [keyDraft, setKeyDraft] = useState(apiKeys[activeProvider.id] ?? "");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const { connected, others } = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = providers.filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.models.some(
          (m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
        )
    );
    const conn: Provider[] = [];
    const rest: Provider[] = [];
    for (const p of filtered) {
      (isConnected(p, apiKeys) ? conn : rest).push(p);
    }
    return { connected: conn, others: rest };
  }, [search, apiKeys, providers]);

  const availableModels = useMemo<AIModel[]>(() => {
    if (!isConnected(selectedProvider, apiKeys)) return [];
    const q = search.toLowerCase();
    if (!q) return selectedProvider.models;
    return selectedProvider.models.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q)
    );
  }, [selectedProvider, apiKeys, search]);

  function handleSelectProvider(p: Provider) {
    setSelectedProvider(p);
    setShowKey(false);
    setKeyDraft(apiKeys[p.id] ?? "");
  }

  function handleSelectModel(m: AIModel) {
    setProviderAndModel(selectedProvider.id, m.id);
    onClose();
  }

  function saveKey(key: string) {
    setApiKey(selectedProvider.id, key.trim());
  }

  const providerConnected = isConnected(selectedProvider, apiKeys);

  return (
    <div className="pv-root">
      {/* ── Top bar ── */}
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
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="pv-search-clear" onClick={() => setSearch("")}>×</button>
          )}
        </div>
      </div>

      {/* ── Two-column body ── */}
      <div className="pv-body">
        {/* Left: provider list */}
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
              onSelect={handleSelectProvider}
            />
          )}
          {others.length > 0 && (
            <ProviderList
              label={connected.length ? "Available" : `Providers (${others.length})`}
              providers={others}
              selected={selectedProvider}
              active={activeProvider}
              apiKeys={apiKeys}
              onSelect={handleSelectProvider}
            />
          )}
        </div>

        {/* Right: detail */}
        <div className="pv-right">
          {/* Provider header */}
          <div
            className="pv-detail-head"
            style={{ "--p-color": selectedProvider.color } as React.CSSProperties}
          >
            <span style={{ color: selectedProvider.color, display: "flex" }}>
              <selectedProvider.Icon size={18} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="pv-detail-name">{selectedProvider.name}</div>
              <div className="pv-detail-sub">
                {selectedProvider.local
                  ? "Local model"
                  : providerConnected
                  ? `${selectedProvider.models.length} model${selectedProvider.models.length !== 1 ? "s" : ""}`
                  : "No API key"}
              </div>
            </div>
            {providerConnected && (
              <span className="pv-connected-pill">
                <FiCheck size={9} /> Connected
              </span>
            )}
          </div>

          {/* API key */}
          {!selectedProvider.local && (
            <div className="pv-key-block">
              <div className="pv-key-label"><FiKey size={10} /> API Key</div>
              <div className="pv-key-row">
                <input
                  type={showKey ? "text" : "password"}
                  className="pv-key-input"
                  placeholder={selectedProvider.keyPlaceholder ?? "API key…"}
                  value={keyDraft}
                  onChange={(e) => setKeyDraft(e.target.value)}
                  onBlur={() => saveKey(keyDraft)}
                  onKeyDown={(e) => e.key === "Enter" && saveKey(keyDraft)}
                />
                <button className="pv-key-btn" onClick={() => setShowKey((v) => !v)}>
                  {showKey ? <FiEyeOff size={11} /> : <FiEye size={11} />}
                </button>
                {keyDraft.trim() && (
                  <button className="pv-key-btn save" onClick={() => saveKey(keyDraft)}>
                    <FiCheck size={11} />
                  </button>
                )}
              </div>
              {!providerConnected && (
                <div className="pv-key-hint">
                  <FiPlus size={9} /> Add your API key to activate this provider
                </div>
              )}
            </div>
          )}

          {/* Models */}
          <div className="pv-models-wrap">
            {providerConnected ? (
              <>
                <div className="pv-models-label">
                  {availableModels.length} model{availableModels.length !== 1 ? "s" : ""}
                </div>
                <div className="pv-model-list">
                  {availableModels.map((m) => {
                    const isActive =
                      m.id === activeModel.id &&
                      selectedProvider.id === activeProvider.id;
                    return (
                      <button
                        key={m.id}
                        className={`pv-model-item ${isActive ? "active" : ""}`}
                        onClick={() => handleSelectModel(m)}
                      >
                        <div className="pv-model-top">
                          <span className="pv-model-name">{m.name}</span>
                          <span
                            className="pv-model-tier"
                            style={{
                              color: TIER_COLORS[m.tier],
                              borderColor: TIER_COLORS[m.tier] + "44",
                            }}
                          >
                            {TIER_LABELS[m.tier]}
                          </span>
                          <span className="pv-model-ctx">{m.contextK}K</span>
                          {isActive && (
                            <FiCheck size={11} style={{ color: "#00b87a", flexShrink: 0 }} />
                          )}
                        </div>
                        <div className="pv-model-desc">{m.description}</div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="pv-no-key">
                <span style={{ color: selectedProvider.color, opacity: 0.3, fontSize: 36 }}>
                  <selectedProvider.Icon />
                </span>
                <p>Set your API key to see available models for {selectedProvider.name}.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Provider list section ────────────────────────────── */

function ProviderList({
  label, providers, selected, active, apiKeys, onSelect,
}: {
  label: string;
  providers: Provider[];
  selected: Provider;
  active: Provider;
  apiKeys: Record<string, string>;
  onSelect: (p: Provider) => void;
}) {
  return (
    <div className="pv-section">
      <div className="pv-section-label">{label}</div>
      {providers.map((p) => {
        const conn = isConnected(p, apiKeys);
        const isSel = p.id === selected.id;
        const isAct = p.id === active.id;
        return (
          <button
            key={p.id}
            className={`pv-provider-row ${isSel ? "selected" : ""}`}
            onClick={() => onSelect(p)}
            style={{ "--p-color": p.color } as React.CSSProperties}
          >
            <span className="pv-provider-icon" style={{ color: p.color }}>
              <p.Icon size={14} />
            </span>
            <span className="pv-provider-name">{p.name}</span>
            {isAct && <span className="pv-dot gold" />}
            {conn && !isAct && <span className="pv-dot teal" />}
          </button>
        );
      })}
    </div>
  );
}
