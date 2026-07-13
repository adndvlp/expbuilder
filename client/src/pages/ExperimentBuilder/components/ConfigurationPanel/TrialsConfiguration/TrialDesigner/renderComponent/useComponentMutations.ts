import type { RenderComponentProps } from "./types";

type Args = Pick<
  RenderComponentProps,
  | "canvasStyles"
  | "comp"
  | "components"
  | "generateConfigFromComponents"
  | "onAutoSave"
  | "onRecordHistory"
  | "setComponents"
  | "toJsPsychCoords"
>;

export function useComponentMutations(args: Args) {
  const scheduleAutosave = (components: typeof args.components) => {
    if (!args.onAutoSave) return;
    const config = args.generateConfigFromComponents(components);
    setTimeout(() => args.onAutoSave?.(config), 100);
  };

  const handleComponentChange = (newAttrs: any) => {
    const { __transient, ...attrs } = newAttrs;
    if (!__transient) args.onRecordHistory?.();

    const updatedComponents = args.components.map((component) => {
      if (component.id !== args.comp.id) return component;
      const updated = { ...component, ...attrs };

      if (!__transient && (attrs.x !== undefined || attrs.y !== undefined)) {
        updated.config = withConfig(
          updated.config,
          "coordinates",
          args.toJsPsychCoords(attrs.x ?? updated.x, attrs.y ?? updated.y),
        );
      }
      if (!__transient && attrs.width !== undefined && attrs.width > 0) {
        const width = args.canvasStyles
          ? (attrs.width / args.canvasStyles.width) * 100
          : attrs.width;
        updated.config = withConfig(updated.config, "width", width);
      }
      if (!__transient && attrs.height !== undefined && attrs.height > 0) {
        const height = args.canvasStyles
          ? (attrs.height / args.canvasStyles.width) * 100
          : attrs.height;
        updated.config = withConfig(updated.config, "height", height);
      }
      if (!__transient && attrs.rotation !== undefined) {
        updated.config = withConfig(updated.config, "rotation", attrs.rotation);
      }
      if (!__transient && attrs.zIndex !== undefined) {
        updated.config = withConfig(updated.config, "zIndex", attrs.zIndex);
      }
      if (
        !__transient &&
        attrs.textFontSize !== undefined &&
        component.type === "TextComponent"
      ) {
        updated.config = withConfig(
          updated.config,
          "font_size",
          attrs.textFontSize,
        );
      }
      if (
        !__transient &&
        attrs.buttonFontSize !== undefined &&
        component.type === "ButtonResponseComponent"
      ) {
        updated.config = withConfig(
          updated.config,
          "button_font_size",
          attrs.buttonFontSize,
        );
      }
      if (
        !__transient &&
        attrs.inputFontSize !== undefined &&
        component.type === "InputResponseComponent"
      ) {
        updated.config = withConfig(
          updated.config,
          "input_font_size",
          attrs.inputFontSize,
        );
      }
      return updated;
    });

    args.setComponents(updatedComponents);
    if (!__transient) scheduleAutosave(updatedComponents);
  };

  const handleDragEnd = (id: string, event: any) => {
    const x = event.target.x();
    const y = event.target.y();
    const coordinates = args.toJsPsychCoords(x, y);
    args.onRecordHistory?.();

    const updatedComponents = args.components.map((component) =>
      component.id === id
        ? {
            ...component,
            x,
            y,
            config: withConfig(component.config, "coordinates", coordinates),
          }
        : component,
    );
    args.setComponents(updatedComponents);
    scheduleAutosave(updatedComponents);
  };

  return { handleComponentChange, handleDragEnd };
}

function withConfig(
  config: Record<string, any> | undefined,
  key: string,
  value: unknown,
) {
  return { ...config, [key]: { source: "typed", value } };
}
