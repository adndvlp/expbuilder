import { useState } from "react";
import CodeEditorModal, { ModalTabDef } from "../../../CodeEditorModal";

export type CodeTab = {
  key: string;
  label: string;
  hint: string;
  fieldKey: string;
  customValue: string;
  computePreview: (userCode: string) => string;
  isBuilderManaged?: boolean;
};

type Props = {
  tabs: CodeTab[];
  onSave: (fieldKey: string, value: string) => void;
};

export default function TrialCodeInjection({ tabs, onSave }: Props) {
  const safeTabs = tabs ?? [];
  const [modalOpen, setModalOpen] = useState(false);
  const [saveIndicator, setSaveIndicator] = useState(false);

  if (!safeTabs.length) return null;

  const hasCustomCode = safeTabs.some((t) => t.customValue.trim());

  const modalTabs: ModalTabDef[] = safeTabs.map((tab) => ({
    key: tab.key,
    label: tab.label,
    value: tab.customValue,
    hint: tab.hint,
    isBuilderManaged: tab.isBuilderManaged,
    splitView: tab.isBuilderManaged,
    computeRightPanel: tab.isBuilderManaged ? tab.computePreview : undefined,
    rightPanelHint: tab.isBuilderManaged ? "Full generated block — read-only · what goes into the HTML" : undefined,
    onChange: (val: string) => {
      onSave(tab.fieldKey, val);
      setSaveIndicator(true);
      setTimeout(() => setSaveIndicator(false), 1500);
    },
  }));

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-dark)" }}>Custom Code</span>
        <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 600, opacity: saveIndicator ? 1 : 0, transition: "opacity 0.3s" }}>
          ✓ Saved
        </span>
      </div>

      {/* Compact status row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        {safeTabs.map((tab) => {
          const lines = tab.customValue.trim().split("\n").filter(Boolean).length;
          return (
            <span
              key={tab.key}
              style={{
                fontSize: 10, padding: "2px 8px", borderRadius: 4,
                background: lines > 0 ? "rgba(61,146,180,0.12)" : "var(--neutral-light)",
                border: `1px solid ${lines > 0 ? "rgba(61,146,180,0.35)" : "var(--neutral-mid)"}`,
                color: lines > 0 ? "var(--primary-blue)" : "#888",
                fontWeight: lines > 0 ? 600 : 400,
              }}
            >
              {tab.label}{lines > 0 ? `: ${lines}L` : ": empty"}
            </span>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setModalOpen(true)}
        style={{
          width: "100%", padding: "8px 14px",
          border: `1px solid ${hasCustomCode ? "rgba(61,146,180,0.5)" : "var(--neutral-mid)"}`,
          borderRadius: 6, cursor: "pointer",
          background: hasCustomCode ? "rgba(61,146,180,0.07)" : "var(--neutral-light)",
          color: "var(--text-dark)",
          fontSize: 12, fontWeight: 500,
          display: "flex", alignItems: "center", gap: 8,
          transition: "all 0.15s",
        }}
      >
        <span style={{ fontSize: 14 }}>⌨</span>
        Open Code Component
        <span style={{ marginLeft: "auto", fontSize: 10, opacity: 0.5, fontFamily: "monospace" }}>
          on_start · on_finish
        </span>
      </button>

      <div style={{ marginTop: 8, padding: "5px 10px", borderRadius: 6, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.35)", fontSize: 10, color: "var(--text-dark)", lineHeight: 1.5 }}>
        Do not modify <code>window.nextTrialId</code>, <code>window.skipRemaining</code>, <code>window.branchingActive</code>, <code>window.branchCustomParameters</code>.
      </div>

      <CodeEditorModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Trial Code Component"
        tabs={modalTabs}
      />
    </div>
  );
}
