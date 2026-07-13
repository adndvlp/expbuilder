import type { Provider } from "../types/providers";
import { isConnected } from "./providerUtils";

interface ProviderListProps {
  label: string;
  providers: Provider[];
  selected: Provider;
  active: Provider;
  apiKeys: Record<string, string>;
  onSelect: (provider: Provider) => void;
}

export function ProviderList({
  label,
  providers,
  selected,
  active,
  apiKeys,
  onSelect,
}: ProviderListProps) {
  return (
    <div className="pv-section">
      <div className="pv-section-label">{label}</div>
      {providers.map((provider) => {
        const connected = isConnected(provider, apiKeys);
        const selectedRow = provider.id === selected.id;
        const activeRow = provider.id === active.id;
        return (
          <button
            key={provider.id}
            className={`pv-provider-row ${selectedRow ? "selected" : ""}`}
            onClick={() => onSelect(provider)}
            style={{ "--p-color": provider.color } as React.CSSProperties}
          >
            <span
              className="pv-provider-icon"
              style={{ color: provider.color }}
            >
              <provider.Icon size={14} />
            </span>
            <span className="pv-provider-name">{provider.name}</span>
            {activeRow && <span className="pv-dot gold" />}
            {connected && !activeRow && <span className="pv-dot teal" />}
          </button>
        );
      })}
    </div>
  );
}
