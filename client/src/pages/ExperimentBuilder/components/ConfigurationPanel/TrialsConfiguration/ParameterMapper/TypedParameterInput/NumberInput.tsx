import type React from "react";
import type { ColumnMappingEntry, ParameterMapperProps } from "../types";
import { inspectorSingleLineInputStyle } from "./styles";

interface Props {
  componentMode: boolean;
  entry: ColumnMappingEntry;
  localInputValues: Record<string, string>;
  onSave: ParameterMapperProps["onSave"];
  paramKey: string;
  setColumnMapping: ParameterMapperProps["setColumnMapping"];
  setLocalInputValues: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
}

export default function NumberInput(props: Props) {
  return (
    <input
      type="number"
      min={0}
      step="any"
      className={props.componentMode ? "" : "w-full p-2 border rounded mt-2"}
      style={props.componentMode ? inspectorSingleLineInputStyle : undefined}
      value={
        props.localInputValues[props.paramKey] ??
        (typeof props.entry.value === "string" ||
        typeof props.entry.value === "number"
          ? props.entry.value
          : "")
      }
      onChange={(event) =>
        props.setLocalInputValues((previous) => ({
          ...previous,
          [props.paramKey]: event.target.value,
        }))
      }
      onBlur={(event) => {
        const newValue = {
          source: "typed" as const,
          value: Number(event.target.value),
        };
        props.setColumnMapping((previous) => ({
          ...previous,
          [props.paramKey]: newValue,
        }));
        if (props.onSave) {
          setTimeout(() => props.onSave?.(props.paramKey, newValue), 100);
        }
        props.setLocalInputValues((previous) => {
          const next = { ...previous };
          delete next[props.paramKey];
          return next;
        });
      }}
    />
  );
}
