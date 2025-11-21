import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { Stage, Layer, Rect } from "react-konva";
import Konva from "konva";
import Modal from "./Modal";
import {
  ImageComponent,
  VideoComponent,
  AudioComponent,
  HtmlComponent,
  ButtonResponseComponent,
  KeyboardResponseComponent,
  SliderResponseComponent,
  InputResponseComponent,
  SketchpadComponent,
  SurveyTextComponent,
  SurveyComponent,
} from "./VisualComponents";
import ParameterMapper from "./index";
import { useComponentMetadata } from "../hooks/useComponentMetadata";
import {
  ComponentType,
  TrialComponent,
  KonvaTrialDesignerProps,
} from "./types";
import ComponentSidebar from "./ComponentSidebar";

// Component types matching backend

const KonvaTrialDesigner: React.FC<KonvaTrialDesignerProps> = ({
  isOpen,
  onClose,
  onSave,
  columnMapping,
  csvColumns,
}) => {
  const [components, setComponents] = useState<TrialComponent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const stageRef = useRef<Konva.Stage>(null);
  const hasLoadedComponents = useRef(false);

  // Get metadata for selected component
  const selectedComponent = components.find((c) => c.id === selectedId);
  const { metadata: componentMetadata, loading: metadataLoading } =
    useComponentMetadata(selectedComponent?.type || null);

  // Resizable panels
  const [leftPanelWidth, setLeftPanelWidth] = useState(280);
  const [rightPanelWidth, setRightPanelWidth] = useState(400);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const isResizingLeft = useRef(false);
  const isResizingRight = useRef(false);

  const CANVAS_WIDTH = 1024;
  const CANVAS_HEIGHT = 768;

  // Convert jsPsych coordinates (-1 to 1) to canvas coordinates (px)
  const fromJsPsychCoords = (coords: { x: number; y: number }) => {
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    return {
      x: centerX + coords.x * (CANVAS_WIDTH / 2),
      y: centerY + coords.y * (CANVAS_HEIGHT / 2),
    };
  };

  // Load components from columnMapping when modal opens
  useEffect(() => {
    if (!isOpen) {
      hasLoadedComponents.current = false;
      return;
    }

    if (hasLoadedComponents.current) return;
    hasLoadedComponents.current = true;

    const loadedComponents: TrialComponent[] = [];
    let idCounter = Date.now();

    // Load stimulus components
    if (columnMapping.components?.value) {
      const componentsArray = Array.isArray(columnMapping.components.value)
        ? columnMapping.components.value
        : [columnMapping.components.value];

      componentsArray.forEach((comp: any) => {
        const canvasCoords = comp.coordinates
          ? fromJsPsychCoords(comp.coordinates)
          : { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };

        // Reconstruct config from component data
        const config: Record<string, any> = {};

        // Si el componente tiene metadata guardada, usarla
        if (comp.__configMetadata) {
          // Usar la metadata guardada para preservar la configuración de source
          Object.entries(comp.__configMetadata).forEach(
            ([key, metadata]: [string, any]) => {
              config[key] = metadata;
            }
          );
        } else {
          // Fallback: reconstruir config como antes (para componentes antiguos sin metadata)
          Object.entries(comp).forEach(([key, value]) => {
            if (
              key !== "type" &&
              key !== "coordinates" &&
              key !== "width" &&
              key !== "height" &&
              key !== "rotation" &&
              key !== "__configMetadata"
            ) {
              let configValue = value;
              if (key === "button_html" && typeof value === "function") {
                configValue = value.toString();
              }
              if (key === "choices" && !Array.isArray(value)) {
                configValue = [String(value)];
              }
              config[key] = {
                source: "typed",
                value: configValue,
              };
            }
          });
        }
        if (comp.coordinates) {
          config.coordinates = {
            source: "typed",
            value: comp.coordinates,
          };
        }
        if (comp.width) {
          config.width = {
            source: "typed",
            value: comp.width,
          };
        }
        if (comp.height) {
          config.height = {
            source: "typed",
            value: comp.height,
          };
        }
        if (comp.rotation !== undefined && comp.rotation !== 0) {
          config.rotation = {
            source: "typed",
            value: comp.rotation,
          };
        }
        loadedComponents.push({
          id: `${comp.type}-${idCounter++}`,
          type: comp.type as ComponentType,
          x: canvasCoords.x,
          y: canvasCoords.y,
          width: comp.width || 300,
          height: comp.height || 300,
          rotation: comp.rotation || 0,
          config: config,
        });
      });
    }

    // Load response components
    if (columnMapping.response_components?.value) {
      const responseArray = Array.isArray(
        columnMapping.response_components.value
      )
        ? columnMapping.response_components.value
        : [columnMapping.response_components.value];

      responseArray.forEach((comp: any) => {
        const canvasCoords = comp.coordinates
          ? fromJsPsychCoords(comp.coordinates)
          : { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
        const config: Record<string, any> = {};

        // Si el componente tiene metadata guardada, usarla
        if (comp.__configMetadata) {
          // Usar la metadata guardada para preservar la configuración de source
          Object.entries(comp.__configMetadata).forEach(
            ([key, metadata]: [string, any]) => {
              config[key] = metadata;
            }
          );
        } else {
          // Fallback: reconstruir config como antes (para componentes antiguos sin metadata)
          Object.entries(comp).forEach(([key, value]) => {
            if (
              key !== "type" &&
              key !== "coordinates" &&
              key !== "width" &&
              key !== "height" &&
              key !== "rotation" &&
              key !== "__configMetadata"
            ) {
              let configValue = value;
              if (key === "button_html" && typeof value === "function") {
                configValue = value.toString();
              }
              if (key === "choices" && !Array.isArray(value)) {
                configValue = [String(value)];
              }
              config[key] = {
                source: "typed",
                value: configValue,
              };
            }
          });
        }
        if (comp.coordinates) {
          config.coordinates = {
            source: "typed",
            value: comp.coordinates,
          };
        }
        if (comp.width) {
          config.width = {
            source: "typed",
            value: comp.width,
          };
        }
        if (comp.height) {
          config.height = {
            source: "typed",
            value: comp.height,
          };
        }
        if (comp.rotation !== undefined && comp.rotation !== 0) {
          config.rotation = {
            source: "typed",
            value: comp.rotation,
          };
        }
        loadedComponents.push({
          id: `${comp.type}-${idCounter++}`,
          type: comp.type as ComponentType,
          x: canvasCoords.x,
          y: canvasCoords.y,
          width: comp.width || 200,
          height: comp.height || 50,
          rotation: comp.rotation || 0,
          config: config,
        });
      });
    }

    // Si el trial está vacío, limpiar los componentes
    if (loadedComponents.length > 0) {
      setComponents(loadedComponents);
    } else {
      setComponents([]);
      setSelectedId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

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

      // Update the component's config
      setComponents((prevComponents) => {
        const updatedComponents = prevComponents.map((comp) => {
          if (comp.id === selectedId) {
            const newConfig =
              typeof updateFn === "function"
                ? updateFn(comp.config || {})
                : updateFn;

            // Sync canvas properties from config changes
            const updated = { ...comp, config: newConfig };

            // Update coordinates if changed in config
            if (newConfig.coordinates?.value) {
              const canvasCoords = fromJsPsychCoords(
                newConfig.coordinates.value
              );
              updated.x = canvasCoords.x;
              updated.y = canvasCoords.y;
            }

            // Update width if changed in config
            if (newConfig.width?.value !== undefined) {
              updated.width = newConfig.width.value;
            }

            // Update height if changed in config
            if (newConfig.height?.value !== undefined) {
              updated.height = newConfig.height.value;
            }

            // Update rotation if changed in config
            if (newConfig.rotation?.value !== undefined) {
              updated.rotation = newConfig.rotation.value;
            }

            return updated;
          }
          return comp;
        });

        return updatedComponents;
      });
    },
    [selectedId]
  );

  // Helper function to build components config from current state
  // This is called only when saving, not continuously
  const buildComponentsConfig = () => {
    const stimulusComponents: any[] = [];
    const responseComponents: any[] = [];

    components.forEach((comp) => {
      const coords = toJsPsychCoords(comp.x, comp.y);
      const componentData: Record<string, any> = {
        type: comp.type,
        coordinates: coords,
        width: comp.width,
        height: comp.height,
      };

      // Add rotation if present
      if (comp.rotation !== undefined && comp.rotation !== 0) {
        componentData.rotation = comp.rotation;
      }

      // Apply parameters from component's config
      // IMPORTANTE: Guardar la metadata de configuración para preservar qué parámetros vienen del CSV
      if (comp.config) {
        const configMetadata: Record<string, any> = {};

        Object.entries(comp.config).forEach(([key, entry]: [string, any]) => {
          // Guardar metadata para TODOS los parámetros excepto las propiedades estructurales
          if (
            key !== "coordinates" &&
            key !== "width" &&
            key !== "height" &&
            key !== "rotation"
          ) {
            configMetadata[key] = {
              source: entry.source,
              value: entry.value,
            };
          }

          // Procesar el valor para guardarlo en componentData (solo si es typed)
          if (entry.source === "typed") {
            let value = entry.value;

            // Special handling for button_html: convert string to function
            if (key === "button_html" && typeof value === "string") {
              try {
                value = eval(`(${value})`);
              } catch (e) {
                console.error("Error evaluating button_html function:", e);
              }
            }

            // Special handling for choices: ensure it's always an array
            if (key === "choices" && !Array.isArray(value)) {
              value = [String(value)];
            }

            // Special handling for labels: convert string to array
            if (key === "labels" && typeof value === "string") {
              value = value.split(",").map((label: string) => label.trim());
            }

            componentData[key] = value;
          } else if (entry.source === "csv") {
            // Para CSV, guardar el nombre de la columna
            componentData[key] = entry.value;
          }
        });

        // Guardar metadata como propiedad especial del componente
        componentData.__configMetadata = configMetadata;
      }

      // Categorize
      const isResponseComponent =
        comp.type === "ButtonResponseComponent" ||
        comp.type === "KeyboardResponseComponent" ||
        comp.type === "SliderResponseComponent" ||
        comp.type === "InputResponseComponent";

      const isSurveyComponent =
        comp.type === "SurveyTextComponent" || comp.type === "SurveyComponent";

      if (isResponseComponent) {
        responseComponents.push(componentData);
      } else if (isSurveyComponent) {
        // Survey components go into stimulus for now
        // Could be changed to separate survey_components if backend supports it
        stimulusComponents.push(componentData);
      } else {
        stimulusComponents.push(componentData);
      }
    });

    return { stimulusComponents, responseComponents };
  };

  // Handle resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft.current) {
        const newWidth = Math.max(0, e.clientX - 20);
        if (newWidth < 200) {
          setShowLeftPanel(false);
        } else {
          setLeftPanelWidth(newWidth);
          setShowLeftPanel(true);
        }
      }

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
    };

    const stopResizing = () => {
      isResizingLeft.current = false;
      isResizingRight.current = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", stopResizing);
    };

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", stopResizing);
    };
  }, []);

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

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  // Convert canvas coordinates (px) to jsPsych coordinates (-1 to 1)
  const toJsPsychCoords = (x: number, y: number) => {
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    return {
      x: Math.max(-1, Math.min(1, (x - centerX) / (CANVAS_WIDTH / 2))),
      y: Math.max(-1, Math.min(1, (y - centerY) / (CANVAS_HEIGHT / 2))),
    };
  };

  // Handle drop from sidebar
  const handleDrop = (
    e: React.DragEvent,
    fileUrl: string,
    type: ComponentType
  ) => {
    e.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const containerRect = stage.container().getBoundingClientRect();
    const x = e.clientX - containerRect.left;
    const y = e.clientY - containerRect.top;

    // Convert to jsPsych coordinates
    const coords = toJsPsychCoords(x, y);

    const newComponent: TrialComponent = {
      id: `${type}-${Date.now()}`,
      type,
      x,
      y,
      width: 0,
      height: 0,
      config: {
        ...getDefaultConfig(type),
        coordinates: {
          source: "typed",
          value: coords,
        },
        ...(type === "ImageComponent" && {
          stimulus: {
            source: "typed",
            value: `${fileUrl}`,
          },
        }),
        ...(type === "VideoComponent" && {
          stimulus: {
            source: "typed",
            value: [`${fileUrl}`],
          },
        }),
        ...(type === "AudioComponent" && {
          stimulus: {
            source: "typed",
            value: `${fileUrl}`,
          },
        }),
      },
    };

    setComponents((prev) => [...prev, newComponent]);
    setSelectedId(newComponent.id);
  };

  // Get default config for component type
  // Return empty object - let jsPsych handle defaults
  const getDefaultConfig = (_type: ComponentType): Record<string, any> => {
    return {};
  };

  // Handle drag end
  const handleDragEnd = (id: string, e: any) => {
    setComponents(
      components.map((comp) => {
        if (comp.id === id) {
          const newX = e.target.x();
          const newY = e.target.y();
          const coords = toJsPsychCoords(newX, newY);

          // Update config with new coordinates
          const newConfig = {
            ...comp.config,
            coordinates: {
              source: "typed",
              value: coords,
            },
          };

          return { ...comp, x: newX, y: newY, config: newConfig };
        }
        return comp;
      })
    );
  };

  // Handle selection
  const handleSelect = (id: string) => {
    setSelectedId(id);
  };

  // Export configuration
  const handleExport = () => {
    // Build components config from current component state
    const { stimulusComponents, responseComponents } = buildComponentsConfig();

    // Start with existing columnMapping to preserve General Settings and other parameters
    const dynamicPluginConfig: Record<string, any> = { ...columnMapping };

    // Clean up any parameters with source:'none' that shouldn't be in columnMapping
    Object.keys(dynamicPluginConfig).forEach((key) => {
      if (dynamicPluginConfig[key]?.source === "none") {
        delete dynamicPluginConfig[key];
      }
    });

    // Update or remove components
    if (stimulusComponents.length > 0) {
      dynamicPluginConfig.components = {
        source: "typed",
        value: stimulusComponents,
      };
    } else {
      delete dynamicPluginConfig.components;
    }

    // Update or remove response_components
    if (responseComponents.length > 0) {
      dynamicPluginConfig.response_components = {
        source: "typed",
        value: responseComponents,
      };
    } else {
      delete dynamicPluginConfig.response_components;
    }

    onSave(dynamicPluginConfig);
    onClose();
  };

  // Render component on canvas
  const renderComponent = (comp: TrialComponent) => {
    const isSelected = comp.id === selectedId;

    const handleComponentChange = (newAttrs: any) => {
      setComponents((prevComponents) =>
        prevComponents.map((c) => {
          if (c.id === comp.id) {
            const updated = { ...c, ...newAttrs };

            // Sync coordinates to config if x/y changed
            if (newAttrs.x !== undefined || newAttrs.y !== undefined) {
              const coords = toJsPsychCoords(
                newAttrs.x ?? updated.x,
                newAttrs.y ?? updated.y
              );
              updated.config = {
                ...updated.config,
                coordinates: {
                  source: "typed",
                  value: coords,
                },
              };
            }

            // Sync width to config if changed and has valid value
            if (newAttrs.width !== undefined && newAttrs.width > 0) {
              updated.config = {
                ...updated.config,
                width: {
                  source: "typed",
                  value: newAttrs.width,
                },
              };
            }

            // Sync height to config if changed and has valid value
            if (newAttrs.height !== undefined && newAttrs.height > 0) {
              updated.config = {
                ...updated.config,
                height: {
                  source: "typed",
                  value: newAttrs.height,
                },
              };
            }

            // Sync rotation to config if changed
            if (newAttrs.rotation !== undefined) {
              updated.config = {
                ...updated.config,
                rotation: {
                  source: "typed",
                  value: newAttrs.rotation,
                },
              };
            }

            return updated;
          }
          return c;
        })
      );
    };
    switch (comp.type) {
      case "ImageComponent":
        return (
          <ImageComponent
            key={comp.id}
            shapeProps={comp}
            isSelected={isSelected}
            onSelect={() => handleSelect(comp.id)}
            onChange={handleComponentChange}
          />
        );

      case "ButtonResponseComponent":
        return (
          <ButtonResponseComponent
            key={comp.id}
            shapeProps={comp}
            isSelected={isSelected}
            onSelect={() => handleSelect(comp.id)}
            onChange={handleComponentChange}
          />
        );

      case "HtmlComponent":
        return (
          <HtmlComponent
            key={comp.id}
            shapeProps={comp}
            isSelected={isSelected}
            onSelect={() => handleSelect(comp.id)}
            onChange={handleComponentChange}
          />
        );

      case "VideoComponent":
        return (
          <VideoComponent
            key={comp.id}
            shapeProps={comp}
            isSelected={isSelected}
            onSelect={() => handleSelect(comp.id)}
            onChange={handleComponentChange}
          />
        );

      case "AudioComponent":
        return (
          <AudioComponent
            key={comp.id}
            shapeProps={comp}
            isSelected={isSelected}
            onSelect={() => handleSelect(comp.id)}
            onChange={handleComponentChange}
          />
        );

      case "KeyboardResponseComponent":
        return (
          <KeyboardResponseComponent
            key={comp.id}
            shapeProps={comp}
            isSelected={isSelected}
            onSelect={() => handleSelect(comp.id)}
            onChange={handleComponentChange}
          />
        );

      case "SliderResponseComponent":
        return (
          <SliderResponseComponent
            key={comp.id}
            shapeProps={comp}
            isSelected={isSelected}
            onSelect={() => handleSelect(comp.id)}
            onChange={handleComponentChange}
          />
        );

      case "InputResponseComponent":
        return (
          <InputResponseComponent
            key={comp.id}
            shapeProps={comp}
            isSelected={isSelected}
            onSelect={() => handleSelect(comp.id)}
            onChange={handleComponentChange}
          />
        );

      case "SketchpadComponent":
        return (
          <SketchpadComponent
            key={comp.id}
            shapeProps={comp}
            isSelected={isSelected}
            onSelect={() => handleSelect(comp.id)}
            onChange={handleComponentChange}
          />
        );

      case "SurveyTextComponent":
        return (
          <SurveyTextComponent
            key={comp.id}
            shapeProps={comp}
            isSelected={isSelected}
            onSelect={() => handleSelect(comp.id)}
            onChange={handleComponentChange}
          />
        );

      case "SurveyComponent":
        return (
          <SurveyComponent
            key={comp.id}
            shapeProps={comp}
            isSelected={isSelected}
            onSelect={() => handleSelect(comp.id)}
            onChange={handleComponentChange}
          />
        );

      default:
        return (
          <Rect
            key={comp.id}
            id={comp.id}
            x={comp.x}
            y={comp.y}
            width={comp.width}
            height={comp.height}
            fill="#e5e7eb"
            stroke={isSelected ? "#374151" : "#9ca3af"}
            strokeWidth={isSelected ? 3 : 1}
            draggable
            onClick={() => handleSelect(comp.id)}
            onDragEnd={(e) => handleDragEnd(comp.id, e)}
            offsetX={comp.width / 2}
            offsetY={comp.height / 2}
          />
        );
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          width: "100%",
        }}
      >
        {/* Main content area with 3 panels */}
        <div style={{ display: "flex", flex: 1, gap: 0, overflow: "hidden" }}>
          <ComponentSidebar
            setLeftPanelWidth={setLeftPanelWidth}
            leftPanelWidth={leftPanelWidth}
            showLeftPanel={showLeftPanel}
            setShowLeftPanel={setShowLeftPanel}
            isResizingLeft={isResizingLeft}
            isOpen={isOpen}
            CANVAS_WIDTH={CANVAS_WIDTH}
            CANVAS_HEIGHT={CANVAS_HEIGHT}
            toJsPsychCoords={toJsPsychCoords}
            setComponents={setComponents}
            getDefaultConfig={getDefaultConfig}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            components={components}
          />
          {/* Canvas */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
              overflow: "auto",
              background: "var(--neutral-light)",
              position: "relative",
            }}
          >
            <div
              style={{
                border: "2px solid var(--neutral-mid)",
                borderRadius: "8px",
                overflow: "hidden",
                background: "var(--neutral-light)",
                position: "relative",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const fileUrl = e.dataTransfer.getData("fileUrl");
                const type = e.dataTransfer.getData("type") as ComponentType;
                if (fileUrl && type) {
                  handleDrop(e, fileUrl, type);
                }
              }}
            >
              {/* Grid background */}
              <div
                style={{
                  position: "absolute",
                  width: CANVAS_WIDTH,
                  height: CANVAS_HEIGHT,
                  backgroundImage: `
                  linear-gradient(var(--neutral-mid) 1px, transparent 1px),
                  linear-gradient(90deg, var(--neutral-mid) 1px, transparent 1px)
                `,
                  backgroundSize: "20px 20px",
                  pointerEvents: "none",
                }}
              />

              {/* Center crosshair */}
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: "20px",
                  height: "20px",
                  margin: "-10px 0 0 -10px",
                  border: "2px solid #ff6b6b",
                  borderRadius: "50%",
                  pointerEvents: "none",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "-100vw",
                    width: "200vw",
                    height: "1px",
                    background: "rgba(255, 107, 107, 0.3)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "-100vh",
                    width: "1px",
                    height: "200vh",
                    background: "rgba(255, 107, 107, 0.3)",
                  }}
                />
              </div>

              <Stage
                ref={stageRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                onClick={(e) => {
                  // Deselect when clicking on empty space
                  if (e.target === e.target.getStage()) {
                    setSelectedId(null);
                  }
                }}
              >
                <Layer>{components.map((comp) => renderComponent(comp))}</Layer>
              </Stage>
            </div>
          </div>

          {/* Right Panel - Parameter Mapper */}
          {showRightPanel && (
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
                  color: "var(--text-light)",
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
                          color: "var(--text-light)",
                        }}
                      >
                        Selected Component
                      </h4>
                      <p
                        style={{
                          margin: "4px 0 0",
                          fontSize: "16px",
                          fontWeight: 700,
                          color: "var(--text-light)",
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
                          color: "var(--text-light)",
                        }}
                      >
                        Loading component parameters...
                      </div>
                    ) : componentMetadata ? (
                      <ParameterMapper
                        parameters={Object.entries(
                          componentMetadata.parameters
                        ).map(([key, param]) => ({
                          key,
                          label:
                            (param as any).pretty_name ||
                            key
                              .replace(/_/g, " ")
                              .replace(/\b\w/g, (l: string) => l.toUpperCase()),
                          type: (param as any).type,
                        }))}
                        columnMapping={componentColumnMapping}
                        setColumnMapping={handleComponentColumnMappingChange}
                        csvColumns={csvColumns}
                        pluginName={selectedComponent.type}
                        componentMode={true}
                        selectedComponentId={selectedId}
                        onComponentConfigChange={(compId, config) => {
                          setComponents((prev) =>
                            prev.map((c) =>
                              c.id === compId ? { ...c, config } : c
                            )
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
                      color: "var(--text-light)",
                    }}
                  >
                    <div
                      style={{ fontSize: "48px", marginBottom: "12px" }}
                    ></div>
                    <p
                      style={{
                        margin: 0,
                        color: "var(--text-light)",
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
                onMouseOut={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              />
            </div>
          )}

          {/* Toggle button for right panel */}
          {!showRightPanel && (
            <button
              onClick={() => setShowRightPanel(true)}
              style={{
                position: "absolute",
                right: 0,
                top: "50%",
                transform: "translateY(-50%)",
                background: "var(--primary-blue)",
                color: "var(--text-light)",
                border: "none",
                borderRadius: "8px 0 0 8px",
                padding: "16px 8px",
                cursor: "pointer",
                zIndex: 20,
                fontSize: "18px",
                fontWeight: "bold",
              }}
            >
              ‹
            </button>
          )}
        </div>

        {/* Action buttons - Fixed at bottom */}
        <div
          style={{
            padding: "12px 16px",
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
            borderTop: "2px solid var(--neutral-mid)",
            background: "var(--neutral-light)",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "10px 20px",
              border: "1px solid var(--danger)",
              borderRadius: "6px",
              background: "var(--danger)",
              color: "var(--text-light)",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            style={{
              padding: "10px 20px",
              border: "none",
              borderRadius: "6px",
              background:
                "linear-gradient(135deg, var(--gold), var(--dark-gold))",
              color: "var(--text-light)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Save Trial
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default KonvaTrialDesigner;
