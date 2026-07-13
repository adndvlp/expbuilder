import { FiChevronDown } from "react-icons/fi";
import { useChat } from "../../../contexts/ChatContext";

export function ProviderBadge({ onOpen }: { onOpen: () => void }) {
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
