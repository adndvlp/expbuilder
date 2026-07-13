import type { ColumnMappingEntry } from "../../../../../../types";

type Source = "csv" | "typed" | "none";

interface Props {
  csvColumns: string[];
  getInitialTypedValue: () => unknown;
  onChange: (source: Source, value: unknown) => void;
  value: ColumnMappingEntry;
}

export default function OverrideSourceSelect({
  csvColumns,
  getInitialTypedValue,
  onChange,
  value,
}: Props) {
  return (
    <select
      value={
        value.source === "typed"
          ? "type_value"
          : value.source === "csv"
            ? String(value.value)
            : ""
      }
      onChange={(event) => {
        const selected = event.target.value;
        const source =
          selected === "type_value"
            ? "typed"
            : selected === ""
              ? "none"
              : "csv";
        const initialValue =
          source === "typed"
            ? getInitialTypedValue()
            : source === "csv"
              ? selected
              : null;
        onChange(source, initialValue);
      }}
      className="w-full border rounded px-2 py-1.5 text-xs"
      style={{
        color: "var(--text-dark)",
        backgroundColor: "var(--neutral-light)",
        borderColor: "var(--neutral-mid)",
      }}
    >
      <option value="">Default</option>
      <option value="type_value">Type value</option>
      {csvColumns.map((column) => (
        <option key={column} value={column}>
          {column}
        </option>
      ))}
    </select>
  );
}
