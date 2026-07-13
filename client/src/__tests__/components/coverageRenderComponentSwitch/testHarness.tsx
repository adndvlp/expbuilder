import { useState } from "react";
import type { TrialComponent } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";

type RenderComponentFn =
  typeof import("../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/renderComponent").default;

export function component(
  type: TrialComponent["type"] | "HtmlComponent" | "UnknownComponent",
  overrides: Partial<TrialComponent> = {},
): TrialComponent {
  return {
    id: `${type}-id`,
    type: type as TrialComponent["type"],
    x: 10,
    y: 20,
    width: 100,
    height: 50,
    rotation: 0,
    zIndex: 1,
    config: {},
    ...overrides,
  };
}

export type RenderComponentHarnessProps = {
  initial: TrialComponent;
  selectedId?: string | null;
  selectedIds?: string[];
  withCanvasStyles?: boolean;
  withAutoSave?: boolean;
};

export function RenderComponentHarness({
  initial,
  selectedId = null,
  selectedIds = [],
  withCanvasStyles = false,
  withAutoSave = true,
  renderComponentFn,
}: RenderComponentHarnessProps & { renderComponentFn: RenderComponentFn }) {
  const [components, setComponents] = useState([
    initial,
    component("AudioComponent", { id: "untouched" }),
  ]);
  const [selected, setSelected] = useState<string | null>(selectedId);
  const [activeDomId, setActiveDomId] = useState<string | null>(null);
  const [editTextId, setEditTextId] = useState<string | null>(null);
  const [saved, setSaved] = useState("none");
  const [historyCount, setHistoryCount] = useState(0);

  const node = renderComponentFn({
    comp: components[0],
    components,
    setComponents,
    selectedId: selected,
    selectedIds,
    setSelectedId: setSelected,
    toJsPsychCoords: (x, y) => ({ x: x + 1, y: y + 2 }),
    onAutoSave: withAutoSave
      ? (config) => setSaved(JSON.stringify(config))
      : undefined,
    generateConfigFromComponents: (next) => ({
      ids: next.map((item) => item.id),
    }),
    uploadedFiles: [{ name: "asset.png", url: "/asset.png" }],
    canvasStyles: withCanvasStyles
      ? {
          width: 500,
          height: 400,
          fullScreen: false,
          progressBar: false,
          backgroundColor: "#fff",
        }
      : undefined,
    htmlSceneMetrics: { [initial.id]: { width: 70, height: 30 } },
    setActiveDomId,
    editingTextId: editTextId,
    onEditTextStart: setEditTextId,
    onRecordHistory: () => setHistoryCount((count) => count + 1),
  });

  return (
    <div>
      {node}
      <output data-testid="state">{JSON.stringify(components[0])}</output>
      <output data-testid="selected">{selected ?? "none"}</output>
      <output data-testid="active">{activeDomId ?? "none"}</output>
      <output data-testid="editing">{editTextId ?? "none"}</output>
      <output data-testid="saved">{saved}</output>
      <output data-testid="history">{historyCount}</output>
    </div>
  );
}
