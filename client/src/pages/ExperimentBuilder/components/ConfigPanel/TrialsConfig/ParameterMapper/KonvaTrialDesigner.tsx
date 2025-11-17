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
import { useExperimentID } from "../../../../hooks/useExperimentID";
import {
  ImageComponent,
  VideoComponent,
  AudioComponent,
  HtmlComponent,
  ButtonResponseComponent,
  KeyboardResponseComponent,
  SliderResponseComponent,
} from "./VisualComponents";
import ParameterMapper from "./index";
import { useComponentMetadata } from "../hooks/useComponentMetadata";
const API_URL = import.meta.env.VITE_API_URL;

// Component types matching backend
type ComponentType =
  | "ImageComponent"
  | "VideoComponent"
  | "AudioComponent"
  | "HtmlComponent"
  | "ButtonResponseComponent"
  | "KeyboardResponseComponent"
  | "SliderResponseComponent";

interface TrialComponent {
  id: string;
  type: ComponentType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  config: Record<string, any>;
}

interface KonvaTrialDesignerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: any) => void;
  initialConfig?: any;
  parameters: any[];
  columnMapping: Record<string, any>;
  setColumnMapping: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  csvColumns: string[];
  pluginName: string;
}

const KonvaTrialDesigner: React.FC<KonvaTrialDesignerProps> = ({
  isOpen,
  onClose,
  onSave,
  initialConfig,
  parameters,
  columnMapping,
  setColumnMapping,
  csvColumns,
  pluginName,
}) => {
  const experimentID = useExperimentID();
  const [components, setComponents] = useState<TrialComponent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedComponentType, setSelectedComponentType] =
    useState<ComponentType | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [audios, setAudios] = useState<string[]>([]);
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
        Object.entries(comp).forEach(([key, value]) => {
          if (
            key !== "type" &&
            key !== "coordinates" &&
            key !== "width" &&
            key !== "height" &&
            key !== "rotation"
          ) {
            // Special handling for button_html: keep as string for editing
            // It will be converted to function when exporting
            let configValue = value;

            // Special handling for button_html functions
            if (key === "button_html" && typeof value === "function") {
              configValue = value.toString();
            }

            // Special handling for choices: ensure it's always an array
            if (key === "choices" && !Array.isArray(value)) {
              configValue = [String(value)];
            }

            config[key] = {
              source: "typed",
              value: configValue,
            };
          }
        });

        // Add coordinates, width, height, and rotation to config
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

        // Reconstruct config from component data
        const config: Record<string, any> = {};
        Object.entries(comp).forEach(([key, value]) => {
          if (
            key !== "type" &&
            key !== "coordinates" &&
            key !== "width" &&
            key !== "height" &&
            key !== "rotation"
          ) {
            // Special handling for button_html: keep as string for editing
            // It will be converted to function when exporting
            let configValue = value;

            // Special handling for button_html functions
            if (key === "button_html" && typeof value === "function") {
              configValue = value.toString();
            }

            // Special handling for choices: ensure it's always an array
            if (key === "choices" && !Array.isArray(value)) {
              configValue = [String(value)];
            }

            config[key] = {
              source: "typed",
              value: configValue,
            };
          }
        });

        // Add coordinates, width, height, and rotation to config
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

    if (loadedComponents.length > 0) {
      setComponents(loadedComponents);
    }
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

  // Update columnMapping whenever components change
  useEffect(() => {
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
      if (comp.config) {
        Object.entries(comp.config).forEach(([key, entry]: [string, any]) => {
          if (entry.source === "typed") {
            let value = entry.value;

            // Special handling for button_html: convert string to function
            if (key === "button_html" && typeof value === "string") {
              try {
                // Evaluate the function string to get the actual function
                value = eval(`(${value})`);
              } catch (e) {
                console.error("Error evaluating button_html function:", e);
              }
            }

            // Special handling for choices: ensure it's always an array
            if (key === "choices" && !Array.isArray(value)) {
              value = [String(value)];
            }

            componentData[key] = value;
          } else if (entry.source === "csv") {
            componentData[key] = entry.value;
          }
        });
      }

      // Categorize
      const isResponseComponent =
        comp.type === "ButtonResponseComponent" ||
        comp.type === "KeyboardResponseComponent" ||
        comp.type === "SliderResponseComponent";

      if (isResponseComponent) {
        responseComponents.push(componentData);
      } else {
        stimulusComponents.push(componentData);
      }
    });

    // Update columnMapping
    const newMapping: Record<string, any> = {};

    if (stimulusComponents.length > 0) {
      newMapping.components = {
        source: "typed",
        value: stimulusComponents,
      };
    }

    if (responseComponents.length > 0) {
      newMapping.response_components = {
        source: "typed",
        value: responseComponents,
      };
    }

    setColumnMapping(newMapping);
  }, [components, setColumnMapping]);

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

  const initResizeLeft = () => {
    isResizingLeft.current = true;
    document.addEventListener("mousemove", (e) => {
      if (isResizingLeft.current) {
        const newWidth = Math.max(0, e.clientX - 20);
        if (newWidth < 200) {
          setShowLeftPanel(false);
        } else {
          setLeftPanelWidth(newWidth);
          setShowLeftPanel(true);
        }
      }
    });
    document.addEventListener("mouseup", () => {
      isResizingLeft.current = false;
    });
  };

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

  // Fetch media files when modal opens
  useEffect(() => {
    if (isOpen && experimentID) {
      // Fetch images
      fetch(`${API_URL}/api/list-files/img/${experimentID}`)
        .then((res) => res.json())
        .then((data) => setImages(data.files?.map((f: any) => f.url) || []))
        .catch((err) => console.error("Error loading images:", err));

      // Fetch videos
      fetch(`${API_URL}/api/list-files/vid/${experimentID}`)
        .then((res) => res.json())
        .then((data) => setVideos(data.files?.map((f: any) => f.url) || []))
        .catch((err) => console.error("Error loading videos:", err));

      // Fetch audios
      fetch(`${API_URL}/api/list-files/aud/${experimentID}`)
        .then((res) => res.json())
        .then((data) => setAudios(data.files?.map((f: any) => f.url) || []))
        .catch((err) => console.error("Error loading audios:", err));
    }
  }, [isOpen, experimentID]);

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

  // Add component to canvas
  const addComponent = (type: ComponentType) => {
    const x = CANVAS_WIDTH / 2;
    const y = CANVAS_HEIGHT / 2;

    // Convert to jsPsych coordinates
    const coords = toJsPsychCoords(x, y);

    const newComponent: TrialComponent = {
      id: `${type}-${Date.now()}`,
      type,
      x,
      y,
      width: type === "ImageComponent" || type === "VideoComponent" ? 300 : 200,
      height: type === "ImageComponent" || type === "VideoComponent" ? 300 : 50,
      config: {
        ...getDefaultConfig(type),
        coordinates: {
          source: "typed",
          value: coords,
        },
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

  // Handle delete
  const handleDelete = () => {
    if (selectedId) {
      setComponents(components.filter((comp) => comp.id !== selectedId));
      setSelectedId(null);
    }
  };

  // Export configuration
  const handleExport = () => {
    // Simply save the current columnMapping which already has
    // components and response_components properly updated
    const dynamicPluginConfig: Record<string, any> = {};

    if (columnMapping.components) {
      dynamicPluginConfig.components = columnMapping.components;
    }

    if (columnMapping.response_components) {
      dynamicPluginConfig.response_components =
        columnMapping.response_components;
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

  const componentTypes: { type: ComponentType; label: string }[] = [
    { type: "ImageComponent", label: "Image" },
    { type: "VideoComponent", label: "Video" },
    { type: "AudioComponent", label: "Audio" },
    { type: "HtmlComponent", label: "HTML" },
    { type: "ButtonResponseComponent", label: "Button" },
    { type: "KeyboardResponseComponent", label: "Keyboard" },
    { type: "SliderResponseComponent", label: "Slider" },
  ];

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
          {/* Left Sidebar - Components */}
          {showLeftPanel && (
            <div
              style={{
                width: `${leftPanelWidth}px`,
                borderRight: "2px solid #e5e7eb",
                display: "flex",
                flexDirection: "column",
                background: "#f9fafb",
                position: "relative",
                height: "100%",
              }}
            >
              <h3
                style={{
                  margin: "0",
                  padding: "12px 16px",
                  fontSize: "16px",
                  fontWeight: 700,
                  background: "#fff",
                  borderBottom: "2px solid #e5e7eb",
                  color: "#1f2937",
                }}
              >
                Components
              </h3>

              {/* Components list with inline media */}
              <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
                {componentTypes.map(({ type, label }) => (
                  <div key={type}>
                    <button
                      onClick={() => {
                        if (
                          type === "ImageComponent" ||
                          type === "VideoComponent" ||
                          type === "AudioComponent"
                        ) {
                          setSelectedComponentType(
                            selectedComponentType === type ? null : type
                          );
                        } else {
                          addComponent(type);
                        }
                      }}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        border: "2px solid",
                        borderColor:
                          selectedComponentType === type
                            ? "#3b82f6"
                            : "#d1d5db",
                        borderRadius: "8px",
                        background:
                          selectedComponentType === type ? "#dbeafe" : "white",
                        cursor: "pointer",
                        textAlign: "left",
                        fontSize: "15px",
                        fontWeight: 600,
                        color:
                          selectedComponentType === type
                            ? "#1e40af"
                            : "#374151",
                        transition: "all 0.2s",
                        marginBottom: "10px",
                        boxShadow:
                          selectedComponentType === type
                            ? "0 2px 8px rgba(59, 130, 246, 0.2)"
                            : "0 1px 3px rgba(0,0,0,0.1)",
                      }}
                      onMouseOver={(e) => {
                        if (selectedComponentType !== type) {
                          e.currentTarget.style.background = "#f3f4f6";
                          e.currentTarget.style.borderColor = "#9ca3af";
                        }
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background =
                          selectedComponentType === type ? "#dbeafe" : "white";
                        e.currentTarget.style.borderColor =
                          selectedComponentType === type
                            ? "#3b82f6"
                            : "#d1d5db";
                      }}
                    >
                      {label}
                    </button>

                    {/* Show thumbnails inline below the button */}
                    {selectedComponentType === type &&
                      type === "ImageComponent" && (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "6px",
                            marginBottom: "12px",
                            padding: "8px",
                            background: "#f9fafb",
                            borderRadius: "4px",
                          }}
                        >
                          {images.length === 0 ? (
                            <p
                              style={{
                                gridColumn: "1 / -1",
                                textAlign: "center",
                                color: "#9ca3af",
                                fontSize: "11px",
                                margin: 0,
                              }}
                            >
                              No images
                            </p>
                          ) : (
                            images.map((imgUrl, idx) => (
                              <div
                                key={idx}
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData("fileUrl", imgUrl);
                                  e.dataTransfer.setData(
                                    "type",
                                    "ImageComponent"
                                  );
                                }}
                                style={{
                                  cursor: "grab",
                                  border: "1px solid #ddd",
                                  borderRadius: "4px",
                                  overflow: "hidden",
                                  aspectRatio: "1",
                                }}
                              >
                                <img
                                  src={`${API_URL}/${imgUrl}`}
                                  alt="thumbnail"
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                  }}
                                />
                              </div>
                            ))
                          )}
                        </div>
                      )}

                    {selectedComponentType === type &&
                      type === "VideoComponent" && (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "6px",
                            marginBottom: "12px",
                            padding: "8px",
                            background: "#f9fafb",
                            borderRadius: "4px",
                          }}
                        >
                          {videos.length === 0 ? (
                            <p
                              style={{
                                gridColumn: "1 / -1",
                                textAlign: "center",
                                color: "#9ca3af",
                                fontSize: "11px",
                                margin: 0,
                              }}
                            >
                              No videos
                            </p>
                          ) : (
                            videos.map((vidUrl, idx) => (
                              <div
                                key={idx}
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData("fileUrl", vidUrl);
                                  e.dataTransfer.setData(
                                    "type",
                                    "VideoComponent"
                                  );
                                }}
                                style={{
                                  cursor: "grab",
                                  border: "1px solid #ddd",
                                  borderRadius: "4px",
                                  overflow: "hidden",
                                  aspectRatio: "16/9",
                                  background: "#000",
                                  position: "relative",
                                }}
                              >
                                <video
                                  src={`${API_URL}/${vidUrl}`}
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                  }}
                                />
                                <div
                                  style={{
                                    position: "absolute",
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    background: "rgba(0,0,0,0.7)",
                                    color: "white",
                                    fontSize: "9px",
                                    padding: "2px 4px",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {vidUrl.split("/").pop()}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}

                    {selectedComponentType === type &&
                      type === "AudioComponent" && (
                        <div
                          style={{
                            marginBottom: "12px",
                            padding: "8px",
                            background: "#f9fafb",
                            borderRadius: "4px",
                          }}
                        >
                          {audios.length === 0 ? (
                            <p
                              style={{
                                textAlign: "center",
                                color: "#9ca3af",
                                fontSize: "11px",
                                margin: 0,
                              }}
                            >
                              No audio
                            </p>
                          ) : (
                            audios.map((audUrl, idx) => (
                              <div
                                key={idx}
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData("fileUrl", audUrl);
                                  e.dataTransfer.setData(
                                    "type",
                                    "AudioComponent"
                                  );
                                }}
                                style={{
                                  padding: "8px",
                                  border: "1px solid #ddd",
                                  borderRadius: "4px",
                                  cursor: "grab",
                                  background: "white",
                                  fontSize: "11px",
                                  marginBottom: "4px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                }}
                              >
                                <span style={{ fontSize: "16px" }}>🎵</span>
                                <span
                                  style={{
                                    flex: 1,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {audUrl.split("/").pop()}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                  </div>
                ))}
              </div>

              {/* Delete button at bottom */}
              {selectedId && (
                <div style={{ padding: "10px", borderTop: "1px solid #ddd" }}>
                  <button
                    onClick={handleDelete}
                    style={{
                      width: "100%",
                      padding: "10px",
                      background: "#ef4444",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Delete Selected
                  </button>
                </div>
              )}

              {/* Resize handle */}
              <div
                onMouseDown={initResizeLeft}
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  width: 4,
                  height: "100%",
                  cursor: "col-resize",
                  background: "transparent",
                  zIndex: 10,
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.background = "#3b82f6")
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              />
            </div>
          )}

          {/* Toggle button for left panel */}
          {!showLeftPanel && (
            <button
              onClick={() => setShowLeftPanel(true)}
              style={{
                position: "absolute",
                left: 0,
                top: "50%",
                transform: "translateY(-50%)",
                background: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "0 8px 8px 0",
                padding: "16px 8px",
                cursor: "pointer",
                zIndex: 20,
                fontSize: "18px",
                fontWeight: "bold",
              }}
            >
              ›
            </button>
          )}

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
              background: "#f5f5f5",
              position: "relative",
            }}
          >
            <div
              style={{
                border: "2px solid #ddd",
                borderRadius: "8px",
                overflow: "hidden",
                background: "white",
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
                  linear-gradient(rgba(0, 0, 0, 0.05) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(0, 0, 0, 0.05) 1px, transparent 1px)
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
                borderLeft: "2px solid #e5e7eb",
                display: "flex",
                flexDirection: "column",
                background: "#ffffff",
                position: "relative",
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: "2px solid #e5e7eb",
                  background: "#f9fafb",
                  position: "sticky",
                  top: 0,
                  zIndex: 5,
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "#1f2937",
                  }}
                >
                  Parameters
                </h3>
              </div>

              <div style={{ flex: 1, padding: "16px", overflowY: "auto" }}>
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
                          color: "#6b7280",
                        }}
                      >
                        Selected Component
                      </h4>
                      <p
                        style={{
                          margin: "4px 0 0",
                          fontSize: "16px",
                          fontWeight: 700,
                          color: "#1f2937",
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
                          color: "#6b7280",
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
                      color: "#9ca3af",
                    }}
                  >
                    <div style={{ fontSize: "48px", marginBottom: "12px" }}>
                      ⚙️
                    </div>
                    <p style={{ margin: 0, fontSize: "14px" }}>
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
                onMouseOver={(e) =>
                  (e.currentTarget.style.background = "#3b82f6")
                }
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
                background: "#3b82f6",
                color: "white",
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
            borderTop: "2px solid #e5e7eb",
            background: "white",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "10px 20px",
              border: "1px solid #dc2626",
              borderRadius: "6px",
              background: "#dc2626",
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
              background: "#2196f3",
              color: "white",
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
