import Switch from "react-switch";
import type { ColumnMappingEntry, ParameterMapperProps } from "../types";

interface Props {
  entry: ColumnMappingEntry;
  onSave: ParameterMapperProps["onSave"];
  paramKey: string;
  setColumnMapping: ParameterMapperProps["setColumnMapping"];
}

export default function BooleanInput({
  entry,
  onSave,
  paramKey,
  setColumnMapping,
}: Props) {
  return (
    <div className="mt-2 flex items-center gap-3">
      <Switch
        checked={entry.value === true}
        onChange={(checked) => {
          const newValue = { source: "typed" as const, value: checked };
          setColumnMapping((previous) => ({
            ...previous,
            [paramKey]: newValue,
          }));
          if (onSave) setTimeout(() => onSave(paramKey, newValue), 100);
        }}
        onColor="#3d92b4"
        onHandleColor="#ffffff"
        handleDiameter={24}
        uncheckedIcon={false}
        checkedIcon={false}
        height={20}
        width={44}
      />
      <span style={{ fontWeight: 500, color: "var(--text-dark)" }}>
        {entry.value === true ? "True" : "False"}
      </span>
    </div>
  );
}
