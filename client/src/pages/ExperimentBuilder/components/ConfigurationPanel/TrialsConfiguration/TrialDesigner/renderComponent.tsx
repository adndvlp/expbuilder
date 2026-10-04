import VisualComponentRenderer from "./renderComponent/VisualComponentRenderer";
import type { RenderComponentProps as Props } from "./renderComponent/types";
import { useComponentMutations } from "./renderComponent/useComponentMutations";

const RenderComponent = ({
  comp,
  setComponents,
  toJsPsychCoords,
  selectedId,
  selectedIds = [],
  onAutoSave,
  generateConfigFromComponents,
  setSelectedId,
  components,
  uploadedFiles = [],
  previewViewport,
  htmlSceneMetrics = {},
  setActiveDomId,
  editingTextId,
  onEditTextStart,
  onRecordHistory,
  shouldSkipMutation,
  onSnap,
  onGuidesChange,
}: Props) => {
  const isSelected = comp.id === selectedId || selectedIds.includes(comp.id);
  const { handleComponentChange, handleDragEnd } = useComponentMutations({
    previewViewport,
    comp,
    components,
    generateConfigFromComponents,
    onAutoSave,
    onRecordHistory,
    shouldSkipMutation,
    setComponents,
    toJsPsychCoords,
  });

  return (
    <VisualComponentRenderer
      previewViewport={previewViewport}
      comp={comp}
      editingTextId={editingTextId}
      htmlSceneMetrics={htmlSceneMetrics}
      isSelected={isSelected}
      onChange={handleComponentChange}
      onDragEnd={handleDragEnd}
      onEditTextStart={onEditTextStart}
      onGuidesChange={onGuidesChange}
      onSelect={() => setSelectedId(comp.id)}
      onSnap={onSnap}
      setActiveDomId={setActiveDomId}
      uploadedFiles={uploadedFiles}
    />
  );
};

export default RenderComponent;
