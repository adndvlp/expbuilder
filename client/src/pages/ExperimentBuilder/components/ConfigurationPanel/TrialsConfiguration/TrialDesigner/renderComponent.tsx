import { TrialComponent, CanvasStyles } from "./types";
import { Rect } from "react-konva";
import {
  ImageComponent,
  VideoComponent,
  AudioComponent,
  HtmlComponent,
  TextComponent,
  ButtonResponseComponent,
  KeyboardResponseComponent,
  SliderResponseComponent,
  InputResponseComponent,
  SketchpadComponent,
  SurveyComponent,
  AudioResponseComponent,
} from "./VisualComponents";

type Props = {
  comp: TrialComponent;
  setComponents: React.Dispatch<React.SetStateAction<TrialComponent[]>>;
  toJsPsychCoords: (
    x: number,
    y: number,
  ) => {
    x: number;
    y: number;
  };
  selectedId: string | null;
  onAutoSave: ((config: any) => void) | undefined;
  generateConfigFromComponents: (
    comps: TrialComponent[],
  ) => Record<string, any>;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  components: TrialComponent[];
  uploadedFiles?: any[];
  canvasStyles?: CanvasStyles;
};

const RenderComponent = ({
  comp,
  setComponents,
  toJsPsychCoords,
  selectedId,
  onAutoSave,
  generateConfigFromComponents,
  setSelectedId,
  components,
  uploadedFiles = [],
  canvasStyles,
}: Props) => {
  const isSelected = comp.id === selectedId;

  const handleComponentChange = (newAttrs: any) => {
    setComponents((prevComponents) => {
      const updatedComponents = prevComponents.map((c) => {
        if (c.id === comp.id) {
          const updated = { ...c, ...newAttrs };

          // Sync coordinates to config if x/y changed
          if (newAttrs.x !== undefined || newAttrs.y !== undefined) {
            const coords = toJsPsychCoords(
              newAttrs.x ?? updated.x,
              newAttrs.y ?? updated.y,
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
            const configWidth = canvasStyles
              ? (newAttrs.width / canvasStyles.width) * 100
              : newAttrs.width;
            updated.config = {
              ...updated.config,
              width: {
                source: "typed",
                value: configWidth,
              },
            };
          }

          // Sync height to config if changed and has valid value
          if (newAttrs.height !== undefined && newAttrs.height > 0) {
            const configHeight = canvasStyles
              ? (newAttrs.height / canvasStyles.width) * 100 // vw units — same denominator as width
              : newAttrs.height;
            updated.config = {
              ...updated.config,
              height: {
                source: "typed",
                value: configHeight,
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

          // Sync zIndex to config if changed
          if (newAttrs.zIndex !== undefined) {
            updated.config = {
              ...updated.config,
              zIndex: {
                source: "typed",
                value: newAttrs.zIndex,
              },
            };
          }

          // Sync font_size to config when TextComponent is resized (Canva-style)
          if (
            newAttrs.textFontSize !== undefined &&
            c.type === "TextComponent"
          ) {
            updated.config = {
              ...updated.config,
              font_size: {
                source: "typed",
                value: newAttrs.textFontSize,
              },
            };
          }

          return updated;
        }
        return c;
      });

      // Trigger autosave
      if (onAutoSave) {
        const config = generateConfigFromComponents(updatedComponents);
        setTimeout(() => onAutoSave(config), 100);
      }

      return updatedComponents;
    });
  };
  // Handle drag end
  const handleDragEnd = (id: string, e: any) => {
    const newX = e.target.x();
    const newY = e.target.y();
    const coords = toJsPsychCoords(newX, newY);

    const updatedComponents = components.map((comp) => {
      if (comp.id === id) {
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
    });

    setComponents(updatedComponents);

    // Trigger autosave
    if (onAutoSave) {
      const config = generateConfigFromComponents(updatedComponents);
      setTimeout(() => onAutoSave(config), 100);
    }
  };

  // Handle selection
  const handleSelect = (id: string) => {
    setSelectedId(id);
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
          uploadedFiles={uploadedFiles}
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

    case "TextComponent":
      return (
        <TextComponent
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
          uploadedFiles={uploadedFiles}
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

    case "AudioResponseComponent":
      return (
        <AudioResponseComponent
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

export default RenderComponent;
