export type ModalTabDef = {
  key: string;
  label: string;
  value: string;
  onChange?: (value: string) => void;
  hint?: string;
  isBuilderManaged?: boolean;
  splitView?: boolean;
  computeRightPanel?: (userCode: string) => string;
  rightPanelHint?: string;
};

export type CodeEditorModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  language?: string;
  initialValue?: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  hint?: string;
  tabs?: ModalTabDef[];
};
