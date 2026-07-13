import { getEditorColors } from "../editorOptions";
import type { ModalTabDef } from "../types";

type ModalTabStripProps = {
  activeTabKey: string;
  isLightMode: boolean;
  onSelect: (key: string) => void;
  tabs: ModalTabDef[];
};

export function ModalTabStrip({
  activeTabKey,
  isLightMode,
  onSelect,
  tabs,
}: ModalTabStripProps) {
  const { tabBg, activeTabBg, inactiveColor, activeColor } =
    getEditorColors(isLightMode);

  return (
    <div
      style={{
        display: "flex",
        background: tabBg,
        borderBottom: `1px solid ${isLightMode ? "#ddd" : "#1e1e1e"}`,
        overflowX: "auto",
        flexShrink: 0,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeTabKey;
        const isReadOnly = !tab.onChange;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onSelect(tab.key)}
            title={tab.hint}
            style={{
              padding: "7px 16px",
              border: "none",
              borderTop: isActive
                ? `2px solid ${tab.isBuilderManaged ? "#f59e0b" : isReadOnly ? "#888" : "#3d92b4"}`
                : "2px solid transparent",
              borderRight: `1px solid ${isLightMode ? "#ddd" : "#1e1e1e"}`,
              background: isActive ? activeTabBg : "transparent",
              color: isActive ? activeColor : inactiveColor,
              fontSize: 12,
              fontWeight: isActive ? 500 : 400,
              fontStyle: isReadOnly ? "italic" : "normal",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "background 0.1s",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {tab.label}
            {tab.isBuilderManaged && (
              <span style={{ fontSize: 9, color: "#f59e0b", fontWeight: 700 }}>
                bld
              </span>
            )}
            {isReadOnly && (
              <span style={{ fontSize: 9, opacity: 0.6 }}>read-only</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
