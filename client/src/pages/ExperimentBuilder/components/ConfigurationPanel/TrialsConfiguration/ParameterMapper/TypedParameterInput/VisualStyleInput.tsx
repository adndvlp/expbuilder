import type { Dispatch, SetStateAction } from "react";
import { FaBold, FaItalic } from "react-icons/fa";
import type { ColumnMappingEntry } from "..";
import {
  ALIGN_BUTTONS,
  FONT_FAMILIES,
  FONT_FAMILY_KEYS,
  NUMBER_STYLE_KEYS,
  getVisualDefaultValue,
} from "./visualStyleConfig";
import {
  buttonStyle,
  fieldStyle,
  segmentedButtonStyle,
} from "./visualStyleStyles";
export {
  getVisualDefaultValue,
  getVisualStylePriority,
  isVisualColorParameter,
  isVisualStyleParameter,
  shouldSpanVisualControl,
} from "./visualStyleConfig";

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

export function numericConfig(paramKey: string) {
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
            const raw = event.target.valueAsNumber;
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
