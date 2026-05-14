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

  if (!safeTabs.length) return null;

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
    },
  }));

  const hasCustomCode = safeTabs.some((t) => t.customValue.trim());

  return (
    <div style={{ marginTop: 16 }}>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        style={{
          width: "100%",
          padding: "8px 14px",
          border: `1px solid ${hasCustomCode ? "#fff" : "var(--neutral-mid)"}`,
          borderRadius: 6,
          cursor: "pointer",
          background: hasCustomCode ? "rgba(255,255,255,0.07)" : "var(--neutral-light)",
          color: hasCustomCode ? "#fff" : "var(--text-dark)",
          fontSize: 12,
          fontWeight: 500,
        }}
      >
        Code Component
      </button>

      <CodeEditorModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Trial Code Component"
        tabs={modalTabs}
      />
    </div>
  );
}
