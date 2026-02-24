import { useEffect, useRef } from "react";
import {
  TrialComponent,
  ComponentType,
  CanvasStyles,
  DEFAULT_CANVAS_STYLES,
} from "./types";

type Props = {
  isOpen: boolean;
  columnMapping: Record<string, any>;
  fromJsPsychCoords: (coords: { x: number; y: number }) => {
    x: number;
    y: number;
  };
  CANVAS_WIDTH: number;
  CANVAS_HEIGHT: number;
  setComponents: React.Dispatch<React.SetStateAction<TrialComponent[]>>;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  setCanvasStyles: React.Dispatch<React.SetStateAction<CanvasStyles>>;
};

export default function useLoadComponents({
  isOpen,
  columnMapping,
  fromJsPsychCoords,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  setComponents,
  setSelectedId,
  setCanvasStyles,
}: Props) {
  const hasLoadedComponents = useRef(false);

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

        // Reconstruir config desde las propiedades guardadas en formato {source, value}
        Object.entries(comp).forEach(([key, value]) => {
          // Ignorar propiedades estructurales y type
          if (
            key !== "type" &&
            key !== "coordinates" &&
            key !== "width" &&
            key !== "height" &&
            key !== "rotation" &&
            key !== "zIndex"
          ) {
            // Asumir que siempre está en formato {source, value}
            if (
              value &&
              typeof value === "object" &&
              "source" in value &&
              "value" in value
            ) {
              config[key] = value;
            }
          }
        });

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
        if (comp.zIndex !== undefined) {
          config.zIndex = {
            source: "typed",
            value: comp.zIndex,
          };
        }

        // Use explicit width/height if saved, otherwise 0 (let component decide its size)
        const numericWidth = typeof comp.width === "number" ? comp.width : 0;
        const numericHeight = typeof comp.height === "number" ? comp.height : 0;

        loadedComponents.push({
          id: `${comp.type}-${idCounter++}`,
          type: comp.type as ComponentType,
          x: canvasCoords.x,
          y: canvasCoords.y,
          width: numericWidth,
          height: numericHeight,
          rotation: comp.rotation || 0,
          zIndex: comp.zIndex ?? 0,
          config: config,
        });
      });
    }

    // Load response components
    if (columnMapping.response_components?.value) {
      const responseArray = Array.isArray(
        columnMapping.response_components.value,
      )
        ? columnMapping.response_components.value
        : [columnMapping.response_components.value];

      responseArray.forEach((comp: any) => {
        const canvasCoords = comp.coordinates
          ? fromJsPsychCoords(comp.coordinates)
          : { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
        const config: Record<string, any> = {};

        // Reconstruir config desde las propiedades guardadas en formato {source, value}
        Object.entries(comp).forEach(([key, value]) => {
          // Ignorar propiedades estructurales y type
          if (
            key !== "type" &&
            key !== "coordinates" &&
            key !== "width" &&
            key !== "height" &&
            key !== "rotation" &&
            key !== "zIndex"
          ) {
            // Si ya está en formato {source, value}, usarlo directamente
            if (
              value &&
              typeof value === "object" &&
              "source" in value &&
              "value" in value
            ) {
              config[key] = value;
            } else {
              // Fallback para datos antiguos sin formato {source, value}
              config[key] = {
                source: "typed",
                value: value,
              };
            }
          }
        });

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
        if (comp.zIndex !== undefined) {
          config.zIndex = {
            source: "typed",
            value: comp.zIndex,
          };
        }

        // Use explicit width/height if saved, otherwise 0 (let component decide its size)
        const numericWidth = typeof comp.width === "number" ? comp.width : 0;
        const numericHeight = typeof comp.height === "number" ? comp.height : 0;

        loadedComponents.push({
          id: `${comp.type}-${idCounter++}`,
          type: comp.type as ComponentType,
          x: canvasCoords.x,
          y: canvasCoords.y,
          width: numericWidth,
          height: numericHeight,
          rotation: comp.rotation || 0,
          zIndex: comp.zIndex ?? 0,
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

    // Restore canvas styles if previously saved
    if (columnMapping.__canvasStyles?.value) {
      const saved = columnMapping.__canvasStyles.value as Partial<CanvasStyles>;
      setCanvasStyles({
        ...DEFAULT_CANVAS_STYLES,
        ...saved,
      });
    } else {
      setCanvasStyles(DEFAULT_CANVAS_STYLES);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
}
