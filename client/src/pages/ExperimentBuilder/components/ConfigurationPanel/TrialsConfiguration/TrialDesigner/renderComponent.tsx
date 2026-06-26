import { TrialComponent, CanvasStyles } from "./types";
import { Rect } from "react-konva";
import {
  ImageComponent,
  VideoComponent,
  AudioComponent,
  TextComponent,
  ButtonResponseComponent,
  KeyboardResponseComponent,
  SliderResponseComponent,
  InputResponseComponent,
  SketchpadComponent,
  AudioResponseComponent,
  FileUploadResponseComponent,
  ClickResponseComponent,
} from "./VisualComponents";
import EditorHitBox from "./experimentalScene/EditorHitBox";
import {
  HtmlSceneMetrics,
  isHtmlSceneComponent,
} from "./experimentalScene/sceneModel";
import { CanvasGuide, SnapBox, SnapResult } from "./editorGuides";

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
  htmlSceneMetrics?: HtmlSceneMetrics;
  setActiveDomId?: React.Dispatch<React.SetStateAction<string | null>>;
  editingTextId?: string | null;
  onEditTextStart?: (id: string) => void;
  onSnap?: (box: SnapBox) => SnapResult;
  onGuidesChange?: (guides: CanvasGuide[]) => void;
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
  htmlSceneMetrics = {},
  setActiveDomId,
  editingTextId,
  onEditTextStart,
  onSnap,
  onGuidesChange,
}: Props) => {
  const isSelected = comp.id === selectedId;

  const handleComponentChange = (newAttrs: any) => {
    const { __transient, ...attrs } = newAttrs;

    setComponents((prevComponents) => {
      const updatedComponents = prevComponents.map((c) => {
        if (c.id === comp.id) {
          const updated = { ...c, ...attrs };

          // Sync coordinates to config if x/y changed
          if (
            !__transient &&
            (attrs.x !== undefined || attrs.y !== undefined)
          ) {
            const coords = toJsPsychCoords(
              attrs.x ?? updated.x,
              attrs.y ?? updated.y,
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
          if (!__transient && attrs.width !== undefined && attrs.width > 0) {
            const configWidth = canvasStyles
              ? (attrs.width / canvasStyles.width) * 100
              : attrs.width;
            updated.config = {
              ...updated.config,
              width: {
                source: "typed",
                value: configWidth,
              },
            };
          }

          // Sync height to config if changed and has valid value
          if (!__transient && attrs.height !== undefined && attrs.height > 0) {
            const configHeight = canvasStyles
              ? (attrs.height / canvasStyles.width) * 100 // vw units — same denominator as width
              : attrs.height;
            updated.config = {
              ...updated.config,
              height: {
                source: "typed",
                value: configHeight,
              },
            };
          }

          // Sync rotation to config if changed
          if (!__transient && attrs.rotation !== undefined) {
            updated.config = {
              ...updated.config,
              rotation: {
                source: "typed",
                value: attrs.rotation,
              },
            };
          }

          // Sync zIndex to config if changed
          if (!__transient && attrs.zIndex !== undefined) {
            updated.config = {
              ...updated.config,
              zIndex: {
                source: "typed",
                value: attrs.zIndex,
              },
            };
          }

          // Sync font_size to config when TextComponent is resized (Canva-style)
          if (
            !__transient &&
            attrs.textFontSize !== undefined &&
            c.type === "TextComponent"
          ) {
            updated.config = {
              ...updated.config,
              font_size: {
                source: "typed",
                value: attrs.textFontSize,
              },
            };
          }

          // Sync button_font_size to config when ButtonResponseComponent is resized
          if (
            !__transient &&
            attrs.buttonFontSize !== undefined &&
            c.type === "ButtonResponseComponent"
          ) {
            updated.config = {
              ...updated.config,
              button_font_size: {
                source: "typed",
                value: attrs.buttonFontSize,
              },
            };
          }

          // Sync input_font_size to config when InputResponseComponent is resized
          if (
            !__transient &&
            attrs.inputFontSize !== undefined &&
            c.type === "InputResponseComponent"
          ) {
            updated.config = {
              ...updated.config,
              input_font_size: {
                source: "typed",
                value: attrs.inputFontSize,
              },
            };
          }

          return updated;
        }
        return c;
      });

      // Trigger autosave
      if (!__transient && onAutoSave) {
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

  if (comp.type === "TextComponent" && (isSelected || editingTextId === comp.id)) {
    return (
      <TextComponent
        key={comp.id}
        shapeProps={comp}
        isSelected={isSelected}
        onSelect={() => handleSelect(comp.id)}
        onChange={handleComponentChange}
        canvasWidth={canvasStyles?.width}
        isEditing={editingTextId === comp.id}
        onEditStart={() => onEditTextStart?.(comp.id)}
        onSnap={onSnap}
        onGuidesChange={onGuidesChange}
      />
    );
  }

  if (isHtmlSceneComponent(comp.type)) {
    return (
      <EditorHitBox
        key={comp.id}
        shapeProps={comp}
        canvasStyles={canvasStyles}
        metric={htmlSceneMetrics[comp.id]}
        isSelected={isSelected}
        onSelect={() => handleSelect(comp.id)}
        onChange={handleComponentChange}
        onActivateDom={() => setActiveDomId?.(comp.id)}
        onEditText={() => onEditTextStart?.(comp.id)}
        onSnap={onSnap}
        onGuidesChange={onGuidesChange}
      />
    );
  }

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
          onSnap={onSnap}
          onGuidesChange={onGuidesChange}
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
          onSnap={onSnap}
          onGuidesChange={onGuidesChange}
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
          onSnap={onSnap}
          onGuidesChange={onGuidesChange}
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
          onSnap={onSnap}
          onGuidesChange={onGuidesChange}
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
          onSnap={onSnap}
          onGuidesChange={onGuidesChange}
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
          onSnap={onSnap}
          onGuidesChange={onGuidesChange}
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
          onSnap={onSnap}
          onGuidesChange={onGuidesChange}
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
          onSnap={onSnap}
          onGuidesChange={onGuidesChange}
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
          onSnap={onSnap}
          onGuidesChange={onGuidesChange}
        />
      );

    case "FileUploadResponseComponent":
      return (
        <FileUploadResponseComponent
          key={comp.id}
          shapeProps={comp}
          isSelected={isSelected}
          onSelect={() => handleSelect(comp.id)}
          onChange={handleComponentChange}
          onSnap={onSnap}
          onGuidesChange={onGuidesChange}
        />
      );

    case "ClickResponseComponent":
      return (
        <ClickResponseComponent
          key={comp.id}
          shapeProps={comp}
          isSelected={isSelected}
          onSelect={() => handleSelect(comp.id)}
          onChange={handleComponentChange}
          onSnap={onSnap}
          onGuidesChange={onGuidesChange}
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
