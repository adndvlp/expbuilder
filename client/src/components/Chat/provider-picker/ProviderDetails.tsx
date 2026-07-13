import { FiCheck, FiEye, FiEyeOff, FiKey, FiPlus } from "react-icons/fi";
import type { AIModel, Provider } from "../types/providers";
import { ProviderModels } from "./ProviderModels";

interface ProviderDetailsProps {
  selectedProvider: Provider;
  activeProvider: Provider;
  activeModel: AIModel;
  providerConnected: boolean;
  localModels: AIModel[] | null;
  localLoading: boolean;
  localError: string | null;
  availableModels: AIModel[];
  keyDraft: string;
  showKey: boolean;
  onKeyDraftChange: (key: string) => void;
  onToggleKey: () => void;
  onSaveKey: () => void;
  onSelectModel: (model: AIModel) => void;
}

export function ProviderDetails(props: ProviderDetailsProps) {
  const {
    selectedProvider,
    providerConnected,
    localModels,
    localLoading,
    localError,
    keyDraft,
    showKey,
    onKeyDraftChange,
    onToggleKey,
    onSaveKey,
  } = props;
  const localDescription = localLoading
    ? "Scanning for models…"
    : localError
      ? localError
      : localModels?.length
        ? `${localModels.length} model${localModels.length !== 1 ? "s" : ""} found`
        : "No models found";

  return (
    <div className="pv-right">
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
              ? localDescription
              : providerConnected
                ? `${selectedProvider.models.length} model${selectedProvider.models.length !== 1 ? "s" : ""}`
                : "No API key"}
          </div>
        </div>
        {selectedProvider.local
          ? localModels &&
            !localError && (
              <span className="pv-connected-pill">
                <FiCheck size={9} /> Running
              </span>
            )
          : providerConnected && (
              <span className="pv-connected-pill">
                <FiCheck size={9} /> Connected
              </span>
            )}
      </div>

      {!selectedProvider.local && (
        <div className="pv-key-block">
          <div className="pv-key-label">
            <FiKey size={10} /> API Key
          </div>
          <div className="pv-key-row">
            <input
              type={showKey ? "text" : "password"}
              className="pv-key-input"
              placeholder={selectedProvider.keyPlaceholder ?? "API key…"}
              value={keyDraft}
              onChange={(event) => onKeyDraftChange(event.target.value)}
              onBlur={onSaveKey}
              onKeyDown={(event) => event.key === "Enter" && onSaveKey()}
            />
            <button className="pv-key-btn" onClick={onToggleKey}>
              {showKey ? <FiEyeOff size={11} /> : <FiEye size={11} />}
            </button>
            {keyDraft.trim() && (
              <button className="pv-key-btn save" onClick={onSaveKey}>
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

      <div className="pv-models-wrap">
        <ProviderModels {...props} onSelect={props.onSelectModel} />
      </div>
    </div>
  );
}
