import { useMemo, useCallback } from "react";
import { ComponentMetadata } from "../hooks/useComponentMetadata";
import { TrialComponent } from "./types";
import ParameterMapper from "../ParameterMapper";

type Props = {
  rightPanelWidth: number;
  selectedId: string | null;
  selectedComponent: TrialComponent | undefined;
  metadataLoading: boolean;
  componentMetadata: ComponentMetadata | null;
  components: TrialComponent[];
  setComponents: React.Dispatch<React.SetStateAction<TrialComponent[]>>;
  fromJsPsychCoords: (coords: { x: number; y: number }) => {
    x: number;
    y: number;
  };
  onAutoSave: ((config: any) => void) | undefined;
  generateConfigFromComponents: (
    comps: TrialComponent[],
  ) => Record<string, any>;
  columnMapping: Record<string, any>;
  isResizingRight: React.RefObject<boolean>;
  setShowRightPanel: React.Dispatch<React.SetStateAction<boolean>>;
  setRightPanelWidth: React.Dispatch<React.SetStateAction<number>>;
  csvColumns: string[];
};

function KonvaParameterMapper({
  rightPanelWidth,
  selectedId,
  selectedComponent,
  metadataLoading,
  componentMetadata,
  components,
  setComponents,
  fromJsPsychCoords,
  onAutoSave,
  generateConfigFromComponents,
  isResizingRight,
  setShowRightPanel,
  setRightPanelWidth,
  csvColumns,
  columnMapping,
}: Props) {
  const initResizeRight = () => {
    isResizingRight.current = true;
    document.addEventListener("mousemove", (e) => {
      if (isResizingRight.current) {
        const modalWidth = window.innerWidth * 0.95;
        const newWidth = Math.max(0, modalWidth - e.clientX);
        if (newWidth < 300) {
          setShowRightPanel(false);
        } else {
          setRightPanelWidth(newWidth);
          setShowRightPanel(true);
        }
      }
    });
    document.addEventListener("mouseup", () => {
      isResizingRight.current = false;
    });
  };

  // Memoize component-specific columnMapping from component's config
  const componentColumnMapping = useMemo(() => {
    if (!selectedId) return {};
    const component = components.find((c) => c.id === selectedId);
    if (!component) return {};
    // Convert component.config to columnMapping format
    return component.config || {};
  }, [selectedId, components]);

  // Handle component parameter changes
  const handleComponentColumnMappingChange = useCallback(
    (updateFn: any) => {
      if (!selectedId) return;

      setComponents((prevComponents) => {
        const updatedComponents = prevComponents.map((comp) => {
          if (comp.id === selectedId) {
            const newConfig =
              typeof updateFn === "function"
                ? updateFn(comp.config || {})
                : updateFn;

            const updated = { ...comp, config: newConfig };

            if (newConfig.coordinates?.value) {
              const canvasCoords = fromJsPsychCoords(
                newConfig.coordinates.value,
              );
              updated.x = canvasCoords.x;
              updated.y = canvasCoords.y;
            }

            if (newConfig.width?.value !== undefined) {
              updated.width = newConfig.width.value;
            }

            if (newConfig.height?.value !== undefined) {
              updated.height = newConfig.height.value;
            }

            if (newConfig.rotation?.value !== undefined) {
              updated.rotation = newConfig.rotation.value;
            }

            return updated;
          }
          return comp;
        });

        // Autosave triggered here
        if (onAutoSave) {
          const config = generateConfigFromComponents(updatedComponents);
          // Debounce could be good here but user asked for "luego me dices" logic,
          // implying immediate action on drop/change might be acceptable or I should use timeout.
          // ParameterMapper uses timeout 100ms. I'll use a small timeout to not block rendering.
          setTimeout(() => onAutoSave(config), 100);
        }

        return updatedComponents;
      });
    },
    [selectedId, onAutoSave, columnMapping],
  );
  return (
    <div
      style={{
        width: `${rightPanelWidth}px`,
        borderLeft: "2px solid var(--neutral-mid)",
        display: "flex",
        flexDirection: "column",
        background: "var(--neutral-light)",
        position: "relative",
        overflowY: "auto",
      }}
    >
      <h3
        style={{
          margin: "0",
          padding: "12px 16px",
          fontSize: "16px",
          fontWeight: 700,
          background: "var(--light-blue)",
          borderBottom: "2px solid var(--neutral-mid)",
          color: "var(--text-light)",
        }}
      >
        Parameters
      </h3>

      <div
        style={{
          flex: 1,
          padding: "16px",
          overflowY: "auto",
          color: "var(--text-dark)",
        }}
      >
        {/* Show component parameters if a component is selected */}
        {selectedId && selectedComponent ? (
          <div>
            <div
              style={{
                marginBottom: "16px",
                paddingBottom: "12px",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <h4
                style={{
                  margin: 0,
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "var(--text-dark)",
                }}
              >
                Selected Component
              </h4>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "var(--text-dark)",
                }}
              >
                {selectedComponent.type.replace(/Component$/, "")}
              </p>
            </div>

            {metadataLoading ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "20px",
                  color: "var(--text-dark)",
                }}
              >
                Loading component parameters...
              </div>
            ) : componentMetadata ? (
              <ParameterMapper
                parameters={Object.entries(componentMetadata.parameters).map(
                  ([key, param]) => ({
                    key,
                    label:
                      (param as any).pretty_name ||
                      key
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (l: string) => l.toUpperCase()),
                    type: (param as any).type,
                  }),
                )}
                columnMapping={componentColumnMapping}
                setColumnMapping={handleComponentColumnMappingChange}
                csvColumns={csvColumns}
                pluginName={selectedComponent.type}
                componentMode={true}
                selectedComponentId={selectedId}
                onComponentConfigChange={(compId, config) => {
                  setComponents((prev) =>
                    prev.map((c) => (c.id === compId ? { ...c, config } : c)),
                  );
                }}
              />
            ) : (
              <div
                style={{
                  textAlign: "center",
                  padding: "20px",
                  color: "#ef4444",
                }}
              >
                Error loading component metadata
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: "40px 20px",
              color: "var(--text-dark)",
            }}
          >
            <div style={{ fontSize: "48px", marginBottom: "12px" }}></div>
            <p
              style={{
                margin: 0,
                color: "var(--text-dark)",
              }}
            >
              Select a component from the canvas to edit its parameters
            </p>
          </div>
        )}
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={initResizeRight}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 4,
          height: "100%",
          cursor: "col-resize",
          background: "transparent",
          zIndex: 10,
        }}
        onMouseOver={(e) => (e.currentTarget.style.background = "#000")}
        onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
      />
    </div>
  );
}

export default KonvaParameterMapper;
