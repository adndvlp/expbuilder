import type { ModalTabDef } from "../types";

type ModalHintProps = {
  activeTabKey: string;
  isLightMode: boolean;
  tabs: ModalTabDef[];
};

export function ModalHint({ activeTabKey, isLightMode, tabs }: ModalHintProps) {
  const hint = tabs.find((tab) => tab.key === activeTabKey)?.hint;
  if (!hint) return null;

  return (
    <div
      style={{
        padding: "4px 14px",
        fontSize: 10,
        color: "#888",
        background: isLightMode ? "#f3f3f3" : "#252526",
        borderTop: `1px solid ${isLightMode ? "#ddd" : "#2b2b2b"}`,
        flexShrink: 0,
      }}
    >
      {hint}
    </div>
  );
}
