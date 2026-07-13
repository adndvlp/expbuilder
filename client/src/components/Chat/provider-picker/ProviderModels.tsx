import { FiCheck, FiLoader } from "react-icons/fi";
import { TIER_COLORS, TIER_LABELS } from "../providers";
import type { AIModel, Provider } from "../types/providers";

interface ProviderModelsProps {
  selectedProvider: Provider;
  activeProvider: Provider;
  activeModel: AIModel;
  providerConnected: boolean;
  localModels: AIModel[] | null;
  localLoading: boolean;
  localError: string | null;
  availableModels: AIModel[];
  onSelect: (model: AIModel) => void;
}

function ModelButton({
  model,
  active,
  local,
  onSelect,
}: {
  model: AIModel;
  active: boolean;
  local?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={`pv-model-item ${active ? "active" : ""}`}
      onClick={onSelect}
    >
      <div className="pv-model-top">
        <span className="pv-model-name">{model.name}</span>
        {!local && (
          <span
            className="pv-model-tier"
            style={{
              color: TIER_COLORS[model.tier],
              borderColor: `${TIER_COLORS[model.tier]}44`,
            }}
          >
            {TIER_LABELS[model.tier]}
          </span>
        )}
        <span className="pv-model-ctx">{model.contextK}K</span>
        {active && (
          <FiCheck size={11} style={{ color: "#00b87a", flexShrink: 0 }} />
        )}
      </div>
      {!local && <div className="pv-model-desc">{model.description}</div>}
    </button>
  );
}

export function ProviderModels(props: ProviderModelsProps) {
  const {
    selectedProvider,
    activeProvider,
    activeModel,
    providerConnected,
    localModels,
    localLoading,
    localError,
    availableModels,
    onSelect,
  } = props;
  const isActive = (model: AIModel) =>
    model.id === activeModel.id && selectedProvider.id === activeProvider.id;

  if (selectedProvider.local) {
    if (localLoading) {
      return (
        <div className="pv-loading">
          <FiLoader size={14} className="pv-loading-spin" />
          <span>Fetching installed models from {selectedProvider.name}…</span>
        </div>
      );
    }
    if (localError) {
      return (
        <EmptyProvider provider={selectedProvider}>
          <p>Could not connect to {selectedProvider.name}.</p>
          <p style={{ fontSize: 11, opacity: 0.6 }}>{localError}</p>
        </EmptyProvider>
      );
    }
    if (localModels?.length) {
      return (
        <>
          <div className="pv-models-label">
            {localModels.length} model{localModels.length !== 1 ? "s" : ""}
          </div>
          <div className="pv-model-list">
            {localModels.map((model) => (
              <ModelButton
                key={model.id}
                model={model}
                active={isActive(model)}
                local
                onSelect={() => onSelect(model)}
              />
            ))}
          </div>
        </>
      );
    }
    return (
      <EmptyProvider provider={selectedProvider}>
        <p>No models found in {selectedProvider.name}.</p>
        <p style={{ fontSize: 11, opacity: 0.6 }}>
          Load a model first, then check again.
        </p>
      </EmptyProvider>
    );
  }

  if (!providerConnected) {
    return (
      <EmptyProvider provider={selectedProvider} colored>
        <p>
          Set your API key to see available models for {selectedProvider.name}.
        </p>
      </EmptyProvider>
    );
  }

  return (
    <>
      <div className="pv-models-label">
        {availableModels.length} model{availableModels.length !== 1 ? "s" : ""}
      </div>
      <div className="pv-model-list">
        {availableModels.map((model) => (
          <ModelButton
            key={model.id}
            model={model}
            active={isActive(model)}
            onSelect={() => onSelect(model)}
          />
        ))}
      </div>
    </>
  );
}

function EmptyProvider({
  provider,
  colored,
  children,
}: {
  provider: Provider;
  colored?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="pv-no-key">
      <span
        style={{
          color: colored ? provider.color : undefined,
          opacity: 0.3,
          fontSize: 36,
        }}
      >
        <provider.Icon />
      </span>
      {children}
    </div>
  );
}
