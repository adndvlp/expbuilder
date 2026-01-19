import { ComponentType, TrialComponent } from "../types";
import type Konva from "konva";

type Props = {
  e: React.DragEvent;
  fileUrl: string;
  type: ComponentType;

  toJsPsychCoords: (
    x: number,
    y: number,
  ) => {
    x: number;
    y: number;
  };
  components: TrialComponent[];
  getDefaultConfig: (_type: ComponentType) => Record<string, any>;
  setComponents: React.Dispatch<React.SetStateAction<TrialComponent[]>>;
  onAutoSave: ((config: any) => void) | undefined;
  generateConfigFromComponents: (
    comps: TrialComponent[],
  ) => Record<string, any>;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  stageRef: React.RefObject<Konva.Stage | null>;
};

export default function handleDrop({
  e,
  fileUrl,
  type,
  components,
  stageRef,
  toJsPsychCoords,
  getDefaultConfig,
  setComponents,
  onAutoSave,
  generateConfigFromComponents,
  setSelectedId,
}: Props) {
  e.preventDefault();
  const stage = stageRef.current;
  if (!stage) return;

  const containerRect = stage.container().getBoundingClientRect();
  const x = e.clientX - containerRect.left;
  const y = e.clientY - containerRect.top;

  // Convert to jsPsych coordinates
  const coords = toJsPsychCoords(x, y);

  // Generate name based on existing components of the same type
  let nameCounter = 1;
  let newName = `${type}_${nameCounter}`;
  const existingNames = new Set(components.map((c) => c.config?.name?.value));

  while (existingNames.has(newName)) {
    nameCounter++;
    newName = `${type}_${nameCounter}`;
  }

  const newComponent: TrialComponent = {
    id: `${type}-${Date.now()}`,
    type,
    x,
    y,
    width: 0,
    height: 0,
    config: {
      ...getDefaultConfig(type),
      name: {
        source: "typed",
        value: newName,
      },
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

  setComponents((prev) => {
    const updatedComponents = [...prev, newComponent];

    // Trigger autosave
    if (onAutoSave) {
      const config = generateConfigFromComponents(updatedComponents);
      setTimeout(() => onAutoSave(config), 100);
    }

    return updatedComponents;
  });
  setSelectedId(newComponent.id);
}
