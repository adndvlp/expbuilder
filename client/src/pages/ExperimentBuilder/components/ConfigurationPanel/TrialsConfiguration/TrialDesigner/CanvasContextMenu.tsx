export type CanvasContextMenuState = {
  x: number;
  y: number;
  canvasX: number;
  canvasY: number;
  componentId: string | null;
};

type Props = {
  state: CanvasContextMenuState | null;
  canCopy: boolean;
  canPaste: boolean;
  canUndo: boolean;
  hasComponents: boolean;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onSelectAll: () => void;
  onUndo: () => void;
  onClose: () => void;
};

type MenuItemProps = {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  destructive?: boolean;
  onClick: () => void;
};

function MenuItem({
  label,
  shortcut,
  disabled = false,
  destructive = false,
  onClick,
}: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: 32,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "7px 10px",
        border: "none",
        background: "transparent",
        color: disabled ? "#94a3b8" : destructive ? "#b91c1c" : "#111827",
        cursor: disabled ? "default" : "pointer",
        fontSize: 13,
        lineHeight: "18px",
        textAlign: "left",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.background = "#e5edf8";
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = "transparent";
      }}
    >
      <span>{label}</span>
      {shortcut && (
        <span
          style={{
            color: disabled ? "#cbd5e1" : "#64748b",
            fontSize: 12,
          }}
        >
          {shortcut}
        </span>
      )}
    </button>
  );
}

export default function CanvasContextMenu({
  state,
  canCopy,
  canPaste,
  canUndo,
  hasComponents,
  onCopy,
  onCut,
  onPaste,
  onDelete,
  onSelectAll,
  onUndo,
  onClose,
}: Props) {
  if (!state) return null;

  const runAction = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div
      role="menu"
      aria-label="Canvas actions"
      onContextMenu={(event) => event.preventDefault()}
      onMouseDown={(event) => event.stopPropagation()}
      style={{
        position: "fixed",
        left: `min(${state.x}px, calc(100vw - 220px))`,
        top: `min(${state.y}px, calc(100vh - 224px))`,
        zIndex: 1000,
        width: 208,
        padding: 6,
        border: "1px solid rgba(15, 23, 42, 0.16)",
        borderRadius: 8,
        background: "#ffffff",
        boxShadow: "0 14px 34px rgba(15, 23, 42, 0.18)",
      }}
    >
      <MenuItem
        label="Copy"
        shortcut="Ctrl+C"
        disabled={!canCopy}
        onClick={() => runAction(onCopy)}
      />
      <MenuItem
        label="Cut"
        shortcut="Ctrl+X"
        disabled={!canCopy}
        onClick={() => runAction(onCut)}
      />
      <MenuItem
        label="Paste"
        shortcut="Ctrl+V"
        disabled={!canPaste}
        onClick={() => runAction(onPaste)}
      />
      <div
        style={{
          height: 1,
          margin: "5px 4px",
          background: "#e2e8f0",
        }}
      />
      <MenuItem
        label="Select All"
        shortcut="Ctrl+A"
        disabled={!hasComponents}
        onClick={() => runAction(onSelectAll)}
      />
      <MenuItem
        label="Undo"
        shortcut="Ctrl+Z"
        disabled={!canUndo}
        onClick={() => runAction(onUndo)}
      />
      <div
        style={{
          height: 1,
          margin: "5px 4px",
          background: "#e2e8f0",
        }}
      />
      <MenuItem
        label="Delete"
        disabled={!canCopy}
        destructive
        onClick={() => runAction(onDelete)}
      />
    </div>
  );
}
