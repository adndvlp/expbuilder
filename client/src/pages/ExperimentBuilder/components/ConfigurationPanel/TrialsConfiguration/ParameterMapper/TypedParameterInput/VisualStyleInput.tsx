import type { CSSProperties, Dispatch, SetStateAction } from "react";
import { FaBold, FaItalic } from "react-icons/fa";
import {
  MdFormatAlignCenter,
  MdFormatAlignLeft,
  MdFormatAlignRight,
} from "react-icons/md";
import type { IconType } from "react-icons";
import type { ColumnMappingEntry } from "..";

type Props = {
  localInputValues: Record<string, string>;
  setColumnMapping: Dispatch<
    SetStateAction<Record<string, ColumnMappingEntry>>
  >;
  paramKey: string;
  type: string;
  entry: ColumnMappingEntry;
  label: string;
  onSave: ((key: string, value: any) => void) | undefined;
  setLocalInputValues: Dispatch<SetStateAction<Record<string, string>>>;
};

const FONT_FAMILY_KEYS = new Set([
  "font_family",
  "button_font_family",
  "input_font_family",
]);

const NUMBER_STYLE_KEYS = new Set([
  "font_size",
  "button_font_size",
  "input_font_size",
  "line_height",
  "border_width",
  "button_border_width",
  "input_border_width",
  "canvas_border_width",
  "border_radius",
  "button_border_radius",
  "input_border_radius",
  "marker_radius",
  "stroke_width",
]);

const TOGGLE_STYLE_KEYS = new Set(["font_weight", "font_style", "text_align"]);

const VISUAL_COLOR_KEYS = new Set([
  "font_color",
  "background_color",
  "border_color",
  "button_color",
  "button_text_color",
  "button_border_color",
  "input_font_color",
  "input_background_color",
  "input_border_color",
  "canvas_border_color",
  "stroke_color",
  "marker_color",
]);

const VISUAL_STYLE_ORDER = [
  "text",
  "choices",
  "font_family",
  "font_size",
  "font_color",
  "font_weight",
  "font_style",
  "text_align",
  "line_height",
  "background_color",
  "border_color",
  "border_width",
  "border_radius",
  "button_color",
  "button_text_color",
  "button_font_family",
  "button_font_size",
  "button_border_color",
  "button_border_width",
  "button_border_radius",
  "input_font_family",
  "input_font_size",
  "input_font_color",
  "input_background_color",
  "input_border_color",
  "input_border_width",
  "input_border_radius",
  "canvas_border_color",
  "canvas_border_width",
  "stroke_color",
  "stroke_width",
  "marker_color",
  "marker_radius",
];

const FONT_FAMILIES = [
  "sans-serif",
  "Arial",
  "Open Sans",
  "Helvetica",
  "Georgia",
  "serif",
  "monospace",
];

const ALIGN_BUTTONS: Array<["left" | "center" | "right", IconType, string]> = [
  ["left", MdFormatAlignLeft, "Align left"],
  ["center", MdFormatAlignCenter, "Align center"],
  ["right", MdFormatAlignRight, "Align right"],
];

export function isVisualColorParameter(paramKey: string) {
  return VISUAL_COLOR_KEYS.has(paramKey) || paramKey.endsWith("_color");
}

export function isVisualStyleParameter(paramKey: string, type = "") {
  return (
    isVisualColorParameter(paramKey) ||
    FONT_FAMILY_KEYS.has(paramKey) ||
    NUMBER_STYLE_KEYS.has(paramKey) ||
    TOGGLE_STYLE_KEYS.has(paramKey) ||
    (type === "number" &&
      (paramKey.includes("font") ||
        paramKey.includes("border") ||
        paramKey.includes("radius")))
  );
}

export function getVisualStylePriority(paramKey: string) {
  const index = VISUAL_STYLE_ORDER.indexOf(paramKey);
  return index === -1 ? 1000 : index;
}

export function shouldSpanVisualControl(paramKey: string) {
  return isVisualStyleParameter(paramKey);
}

export function getVisualDefaultValue(paramKey: string, type = "") {
  if (paramKey === "font_weight") return "normal";
  if (paramKey === "font_style") return "normal";
  if (paramKey === "text_align") return "center";
  if (FONT_FAMILY_KEYS.has(paramKey)) return "sans-serif";
  if (paramKey === "line_height") return 1.5;
  if (paramKey.includes("border_width")) return 0;
  if (paramKey.includes("border_radius")) return 0;
  if (paramKey === "stroke_width") return 3;
  if (paramKey === "marker_radius") return 8;
  if (paramKey.includes("font_size")) return 16;
  if (paramKey === "background_color") return "transparent";
  if (paramKey.includes("border_color")) return "transparent";
  if (paramKey === "button_color") return "#e7e7e7";
  if (paramKey === "button_text_color") return "#000000";
  if (isVisualColorParameter(paramKey)) return "#000000";
  if (type === "number") return 0;
  return "";
}

function commitValue({
  paramKey,
  value,
  setColumnMapping,
  onSave,
  setLocalInputValues,
}: {
  paramKey: string;
  value: any;
  setColumnMapping: Props["setColumnMapping"];
  onSave: Props["onSave"];
  setLocalInputValues: Props["setLocalInputValues"];
}) {
  const newValue = { source: "typed" as const, value };
  setColumnMapping((prev) => ({ ...prev, [paramKey]: newValue }));
  if (onSave) setTimeout(() => onSave(paramKey, newValue), 100);
  setLocalInputValues((prev) => {
    const next = { ...prev };
    delete next[paramKey];
    return next;
  });
}

const CONTROL_BORDER = "#3d5066";
const CONTROL_BG = "#0e1724";
const CONTROL_TEXT = "#f8fafc";
const CONTROL_MUTED = "#cbd5e1";
const CONTROL_ACTIVE_BG = "#164e63";
const CONTROL_ACTIVE_BORDER = "#38bdf8";

const fieldStyle: CSSProperties = {
  width: "100%",
  height: 36,
  border: `1px solid ${CONTROL_BORDER}`,
  borderRadius: 8,
  background: CONTROL_BG,
  color: CONTROL_TEXT,
  padding: "0 10px",
  outline: "none",
  boxSizing: "border-box",
};

function buttonStyle(active: boolean): CSSProperties {
  return {
    width: 36,
    height: 36,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: active
      ? `1px solid ${CONTROL_ACTIVE_BORDER}`
      : `1px solid ${CONTROL_BORDER}`,
    borderRadius: 8,
    background: active ? CONTROL_ACTIVE_BG : "#172233",
    color: active ? "#e0f2fe" : CONTROL_MUTED,
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
    fontSize: 16,
    fontWeight: 700,
    lineHeight: 1,
  };
}

function segmentedButtonStyle(
  active: boolean,
  index: number,
  total: number,
): CSSProperties {
  return {
    ...buttonStyle(active),
    width: 38,
    borderRadius:
      total === 1
        ? 8
        : index === 0
          ? "8px 0 0 8px"
          : index === total - 1
            ? "0 8px 8px 0"
            : 0,
    background: active ? CONTROL_ACTIVE_BG : CONTROL_BG,
    color: active ? "#e0f2fe" : CONTROL_MUTED,
    marginLeft: index === 0 ? 0 : -1,
  };
}

function numericConfig(paramKey: string) {
  if (paramKey === "line_height") return { min: 0.5, max: 4, step: 0.1 };
  if (paramKey.includes("font_size")) return { min: 1, max: 240, step: 1 };
  if (paramKey.includes("border_width")) return { min: 0, max: 48, step: 1 };
  if (paramKey.includes("border_radius")) return { min: 0, max: 120, step: 1 };
  if (paramKey === "stroke_width") return { min: 1, max: 48, step: 1 };
  if (paramKey === "marker_radius") return { min: 1, max: 80, step: 1 };
  return { min: 0, max: 1000, step: 1 };
}

function clampNumber(value: number, paramKey: string) {
  const config = numericConfig(paramKey);
  return Math.min(config.max, Math.max(config.min, value));
}

function VisualStyleInput({
  localInputValues,
  setColumnMapping,
  paramKey,
  type,
  entry,
  onSave,
  label,
  setLocalInputValues,
}: Props) {
  const fallback = getVisualDefaultValue(paramKey, type);
  const current =
    localInputValues[paramKey] ??
    (entry.value !== undefined && entry.value !== null
      ? entry.value
      : fallback);

  const commit = (value: any) =>
    commitValue({
      paramKey,
      value,
      setColumnMapping,
      onSave,
      setLocalInputValues,
    });

  if (FONT_FAMILY_KEYS.has(paramKey)) {
    const value = typeof current === "string" ? current : String(fallback);
    return (
      <select
        className=""
        aria-label={label}
        value={value}
        onChange={(event) => commit(event.target.value)}
        style={fieldStyle}
      >
        {FONT_FAMILIES.map((font) => (
          <option key={font} value={font}>
            {font}
          </option>
        ))}
      </select>
    );
  }

  if (NUMBER_STYLE_KEYS.has(paramKey)) {
    const config = numericConfig(paramKey);
    const numericValue = Number(current);
    const value = Number.isFinite(numericValue)
      ? numericValue
      : Number(fallback) || config.min;
    const changeBy = (delta: number) => {
      const next = clampNumber(Number((value + delta).toFixed(2)), paramKey);
      commit(next);
    };

    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          minWidth: 0,
        }}
      >
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => changeBy(-config.step)}
          style={buttonStyle(false)}
        >
          -
        </button>
        <input
          type="number"
          aria-label={label}
          min={config.min}
          max={config.max}
          step={config.step}
          className=""
          style={{
            ...fieldStyle,
            flex: 1,
            minWidth: 0,
            textAlign: "center",
          }}
          value={String(current)}
          onChange={(event) => {
            setLocalInputValues((prev) => ({
              ...prev,
              [paramKey]: event.target.value,
            }));
          }}
          onBlur={(event) => {
            const raw = Number(event.target.value);
            commit(clampNumber(Number.isFinite(raw) ? raw : value, paramKey));
          }}
        />
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => changeBy(config.step)}
          style={buttonStyle(false)}
        >
          +
        </button>
      </div>
    );
  }

  if (paramKey === "font_weight") {
    const active = current === "bold";
    return (
      <div style={{ display: "inline-flex", alignItems: "center" }}>
        <button
          type="button"
          aria-label="Bold"
          title="Bold"
          onClick={() => commit(active ? "normal" : "bold")}
          style={segmentedButtonStyle(active, 0, 1)}
        >
          <FaBold />
        </button>
      </div>
    );
  }

  if (paramKey === "font_style") {
    const active = current === "italic";
    return (
      <div style={{ display: "inline-flex", alignItems: "center" }}>
        <button
          type="button"
          aria-label="Italic"
          title="Italic"
          onClick={() => commit(active ? "normal" : "italic")}
          style={segmentedButtonStyle(active, 0, 1)}
        >
          <FaItalic />
        </button>
      </div>
    );
  }

  if (paramKey === "text_align") {
    const value =
      current === "left" || current === "right" || current === "center"
        ? current
        : "center";

    return (
      <div style={{ display: "inline-flex", alignItems: "center" }}>
        {ALIGN_BUTTONS.map(([align, Icon, title], index) => (
          <button
            key={align}
            type="button"
            aria-label={title}
            title={title}
            onClick={() => commit(align)}
            style={segmentedButtonStyle(
              value === align,
              index,
              ALIGN_BUTTONS.length,
            )}
          >
            <Icon />
          </button>
        ))}
      </div>
    );
  }

  return null;
}

export default VisualStyleInput;
