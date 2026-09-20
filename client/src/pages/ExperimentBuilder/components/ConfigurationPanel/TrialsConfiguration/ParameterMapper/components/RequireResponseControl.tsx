import { useState } from "react";
import Switch from "react-switch";
import {
  labelStyle as INSPECTOR_LABEL_STYLE,
  selectStyle as INSPECTOR_SELECT_STYLE,
} from "../inspector/styles";
import type { ColumnMappingEntry, ParameterMapperProps } from "../types";

type ResponseComponentOption = { id: string; label: string };

function prettifyComponentType(type: string): string {
  return String(type)
    .replace(/Component$/, "")
    .replace(/([A-Z])/g, " $1")
    .trim();
}

function getResponseComponentOptions(
  columnMapping: Record<string, ColumnMappingEntry>,
): ResponseComponentOption[] {
  const raw = columnMapping["response_components"]?.value;
  const list = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
  const counts: Record<string, number> = {};

  return list
    .filter((comp: any) => comp && comp.type)
    .map((comp: any) => {
      counts[comp.type] = (counts[comp.type] || 0) + 1;
      // Same identity the runtime resolves: component_id (designer id) with the
      // runtime auto-name as fallback for trials saved before ids were kept.
      const id = comp.component_id ?? `${comp.type}_${counts[comp.type]}`;
      return {
        id: String(id),
        label: `${prettifyComponentType(comp.type)} ${counts[comp.type]}`,
      };
    });
}

type Props = {
  columnMapping: Record<string, ColumnMappingEntry>;
  componentMode: boolean;
  onSave: ParameterMapperProps["onSave"];
  setColumnMapping: ParameterMapperProps["setColumnMapping"];
};

export default function RequireResponseControl({
  columnMapping,
  componentMode,
  onSave,
  setColumnMapping,
}: Props) {
  const entry = columnMapping["require_response_components"] ?? {
    source: "none",
    value: [],
  };
  const selected: string[] = Array.isArray(entry.value)
    ? entry.value.map(String)
    : [];
  const [enabled, setEnabled] = useState(selected.length > 0);
  const options = getResponseComponentOptions(columnMapping);

  const save = (value: string[]) => {
    const newValue = { source: "typed" as const, value };
    setColumnMapping((prev) => ({
      ...prev,
      require_response_components: newValue,
    }));
    if (onSave) {
      setTimeout(() => onSave("require_response_components", newValue), 100);
    }
  };

  const toggleEnabled = (checked: boolean) => {
    setEnabled(checked);
    if (!checked) save([]);
  };

  return (
    <div>
      <div
        data-testid="require-response-toggle"
        aria-checked={enabled}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            toggleEnabled(!enabled);
          }
        }}
        style={{ display: "flex", alignItems: "center", gap: 12 }}
      >
        <Switch
          checked={enabled}
          onChange={toggleEnabled}
          onColor="#f1c40f"
          onHandleColor="#ffffff"
          handleDiameter={24}
          uncheckedIcon={false}
          checkedIcon={false}
          height={20}
          width={44}
        />
        <label
          className={componentMode ? "" : "text-sm font-medium"}
          style={componentMode ? INSPECTOR_LABEL_STYLE : { margin: 0 }}
        >
          Require response
        </label>
      </div>

      {enabled && (
        <div>
          <label
            className={
              componentMode ? "" : "mb-2 mt-3 block text-sm font-medium"
            }
            style={componentMode ? INSPECTOR_LABEL_STYLE : {}}
          >
            Select required components:
          </label>
          <select
            multiple
            value={selected}
            onChange={(e) =>
              save(Array.from(e.target.selectedOptions, (opt) => opt.value))
            }
            className={componentMode ? "" : "w-full p-2 border rounded mt-1"}
            style={
              componentMode
                ? INSPECTOR_SELECT_STYLE
                : { color: "var(--text-dark)" }
            }
          >
            {options.length > 0 ? (
              options.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))
            ) : (
              <option disabled>No components available</option>
            )}
          </select>
        </div>
      )}
    </div>
  );
}
