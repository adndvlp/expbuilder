import { useMemo, useCallback } from "react";
import { ComponentMetadata } from "../hooks/useComponentMetadata";
import { TrialComponent } from "./types";
import { syncConfigToComponent } from "./syncConfigToComponent";
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
  canvasWidth: number;
  onAutoSave: ((config: any) => void) | undefined;
  generateConfigFromComponents: (
    comps: TrialComponent[],
  ) => Record<string, any>;
  isResizingRight: React.RefObject<boolean>;
  setShowRightPanel: React.Dispatch<React.SetStateAction<boolean>>;
  setRightPanelWidth: React.Dispatch<React.SetStateAction<number>>;
  csvColumns: string[];
  uploadedFiles?: { name: string; url: string; type: string }[];
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
  canvasWidth,
  onAutoSave,
  generateConfigFromComponents,
  isResizingRight,
  setShowRightPanel,
  setRightPanelWidth,
  csvColumns,
  uploadedFiles = [],
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
          if (comp.id !== selectedId) return comp;

          const newConfig =
            typeof updateFn === "function"
              ? updateFn(comp.config || {})
              : updateFn;

          // Sync ALL config keys that have a Konva visual counterpart
          // (coordinates → x/y, width, height, rotation, zIndex,
          //  and per-component style fields like button colours)
          return syncConfigToComponent(
            comp,
            newConfig,
            fromJsPsychCoords,
            canvasWidth,
          );
        });

        if (onAutoSave) {
          const config = generateConfigFromComponents(updatedComponents);
          setTimeout(() => onAutoSave(config), 100);
        }

        return updatedComponents;
      });
    },
    [
      selectedId,
      onAutoSave,
      setComponents,
      fromJsPsychCoords,
      generateConfigFromComponents,
      canvasWidth,
    ],
  );
  return (
    <div
      style={{
        width: `${rightPanelWidth}px`,
        borderLeft: "1px solid #3a4652",
        display: "flex",
        flexDirection: "column",
        background: "#20262e",
        position: "relative",
        overflowY: "auto",
      }}
    >
      <h3
        style={{
          margin: "0",
          padding: "12px 18px",
          fontSize: "16px",
          fontWeight: 700,
          background: "var(--light-blue)",
          borderBottom: "1px solid #3a4652",
          color: "var(--text-light)",
        }}
      >
        Parameters
      </h3>

      <div
        style={{
          flex: 1,
          padding: 0,
          overflowY: "auto",
          color: "#e5edf3",
        }}
      >
        {/* Show component parameters if a component is selected */}
        {selectedId && selectedComponent ? (
          <div>
            <div
              style={{
                margin: "14px 16px 8px",
                padding: "0 0 14px",
                borderBottom: "1px solid rgba(148, 163, 184, 0.22)",
              }}
            >
              <div
                style={{
                  margin: 0,
                  color: "#95a8b8",
                  fontSize: 12,
                  fontWeight: 700,
                  lineHeight: "16px",
                }}
              >
                Selected Component
              </div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  minHeight: 30,
                  marginTop: 6,
                  padding: "4px 10px",
                  border: "1px solid rgba(56, 189, 248, 0.38)",
                  borderRadius: 8,
                  background: "rgba(14, 116, 144, 0.16)",
                  color: "#f8fafc",
                  fontSize: 18,
                  fontWeight: 800,
                  lineHeight: "22px",
                }}
              >
                {selectedComponent.type.replace(/Component$/, "")}
              </div>
            </div>

            {metadataLoading ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "20px",
                  color: "#cbd5e1",
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
                uploadedFiles={uploadedFiles}
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
              color: "#cbd5e1",
            }}
          >
            <div style={{ fontSize: "48px", marginBottom: "12px" }}></div>
            <p
              style={{
                margin: 0,
                color: "#cbd5e1",
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
