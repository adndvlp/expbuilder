/**
 * syncConfigToComponent
 *
 * Single source of truth for translating a component's config (the
 * `{ source, value }` map the ParameterMapper produces) into the
 * flat top-level fields that Konva reads directly on `TrialComponent`.
 *
 * Mirrors the same pattern used for `x/y` (coordinates), `width`,
 * `height`, `rotation`, and `zIndex`.
 *
 * Adding a new visual prop in the future:
 *   1. Add the field to `TrialComponent` in types.ts
 *   2. Add a row to COMPONENT_STYLE_MAPS below
 *   3. That's it – KonvaParameterMapper, useLoadComponents, and the
 *      Konva visual component all benefit automatically.
 */

import { TrialComponent } from "./types";

type FromJsPsychCoords = (coords: { x: number; y: number }) => {
  x: number;
  y: number;
};

/**
 * Per-component-type config-key → TrialComponent field mappings.
 * Add new component types / keys here to extend visual sync.
 */
const COMPONENT_STYLE_MAPS: Partial<
  Record<TrialComponent["type"], Record<string, keyof TrialComponent>>
> = {
  ButtonResponseComponent: {
    button_color: "buttonColor",
    button_text_color: "buttonTextColor",
    button_font_size: "buttonFontSize",
    button_border_radius: "buttonBorderRadius",
    button_border_color: "buttonBorderColor",
    button_border_width: "buttonBorderWidth",
  },
  TextComponent: {
    font_color: "textFontColor",
    font_size: "textFontSize",
    font_family: "textFontFamily",
    font_weight: "textFontWeight",
    font_style: "textFontStyle",
    text_align: "textAlign",
    background_color: "textBackgroundColor",
    border_radius: "textBorderRadius",
    border_color: "textBorderColor",
    border_width: "textBorderWidth",
  },
};

/**
 * Apply a fresh newConfig snapshot onto a TrialComponent, syncing every
 * field that has a visual Konva counterpart.
 *
 * Returns a new object (does not mutate `comp`).
 */
export function syncConfigToComponent(
  comp: TrialComponent,
  newConfig: Record<string, any>,
  fromJsPsychCoords: FromJsPsychCoords,
  canvasWidth = 0,
): TrialComponent {
  const updated: TrialComponent = { ...comp, config: newConfig };

  // ── Universal fields ────────────────────────────────────────────────

  if (newConfig.coordinates?.value) {
    const canvasCoords = fromJsPsychCoords(newConfig.coordinates.value);
    updated.x = canvasCoords.x;
    updated.y = canvasCoords.y;
  }

  if (newConfig.width?.value !== undefined) {
    // Config stores width/height as vw% (0-100) relative to canvasWidth.
    // Convert back to pixels when canvasWidth is available.
    updated.width =
      canvasWidth > 0
        ? (newConfig.width.value / 100) * canvasWidth
        : newConfig.width.value;
  }

  if (newConfig.height?.value !== undefined) {
    // Height also uses vw% (same denominator as width, see renderComponent.tsx)
    updated.height =
      canvasWidth > 0
        ? (newConfig.height.value / 100) * canvasWidth
        : newConfig.height.value;
  }

  if (newConfig.rotation?.value !== undefined) {
    updated.rotation = newConfig.rotation.value;
  }

  if (newConfig.zIndex?.value !== undefined) {
    updated.zIndex = newConfig.zIndex.value;
  }

  // ── Per-component-type style fields ─────────────────────────────────

  const styleMap = COMPONENT_STYLE_MAPS[comp.type];
  if (styleMap) {
    for (const [configKey, compField] of Object.entries(styleMap)) {
      if (newConfig[configKey]?.value !== undefined) {
        (updated as any)[compField] = newConfig[configKey].value;
      }
    }
  }

  return updated;
}

/**
 * restoreStyleFields
 *
 * Rebuilds top-level style fields from a loaded component's config.
 * Called by useLoadComponents after config reconstruction, so that the
 * Konva canvas has the correct colours/sizes on first render.
 */
export function restoreStyleFields(comp: TrialComponent): TrialComponent {
  const styleMap = COMPONENT_STYLE_MAPS[comp.type];
  if (!styleMap) return comp;

  const updates: Partial<TrialComponent> = {};
  for (const [configKey, compField] of Object.entries(styleMap)) {
    const entry = comp.config[configKey];
    if (entry?.value !== undefined) {
      (updates as any)[compField] = entry.value;
    }
  }

  return Object.keys(updates).length > 0 ? { ...comp, ...updates } : comp;
}
