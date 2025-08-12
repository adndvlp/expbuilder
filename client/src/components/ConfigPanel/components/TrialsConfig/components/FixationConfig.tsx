import React from "react";

type FixationField = {
  label: string;
  key: string;
  type: string;
};

type ColumnMappingEntry = {
  source: "csv" | "typed" | "none";
  value: any;
};

type FixationConfigProps = {
  includeFixation: boolean;
  setIncludeFixation: (b: boolean) => void;
  fixationFields: FixationField[];
  columnMapping: Record<string, ColumnMappingEntry>;
  setColumnMapping: React.Dispatch<
    React.SetStateAction<Record<string, ColumnMappingEntry>>
  >;
  csvColumns: string[];
};

const FixationConfig: React.FC<FixationConfigProps> = ({
  includeFixation,
  setIncludeFixation,
  fixationFields,
  columnMapping,
  setColumnMapping,
  csvColumns,
}) => (
  <div className="mb-4 p-4 border rounded bg-gray-50">
    <div className="flex items-center">
      <input
        type="checkbox"
        id="includeFixation"
        checked={includeFixation}
        onChange={(e) => setIncludeFixation(e.target.checked)}
        className="mr-2"
      />
      <label htmlFor="includeFixation" className="font-bold">
        Include fixation point
      </label>
    </div>

    {includeFixation && (
      <div className="pl-6">
        <div>
          <h5 className="mt-3 mb-0">Fixation Point Parameters</h5>
          <div className="grid grid-cols-2 gap-2">
            {fixationFields.map(({ label, key, type }) => {
              const entry = columnMapping[key] || { source: "none" };

              const handleTypedValueChange = (value: any) => {
                setColumnMapping((prev) => ({
                  ...prev,
                  [key]: {
                    source: "typed",
                    value,
                  },
                }));
              };

              return (
                <div key={key}>
                  <label className="mb-2 mt-3 block text-sm font-medium">
                    {label}
                  </label>

                  <select
                    value={
                      entry.source === "typed"
                        ? "type_value"
                        : entry.source === "csv" &&
                          (typeof entry.value === "string" ||
                            typeof entry.value === "number")
                        ? entry.value
                        : ""
                    }
                    onChange={(e) => {
                      const value = e.target.value;
                      const source =
                        value === "type_value"
                          ? "typed"
                          : value === ""
                          ? "none"
                          : "csv";

                      setColumnMapping((prev) => ({
                        ...prev,
                        [key]: {
                          source,
                          value: source === "typed" ? "" : value,
                        },
                      }));
                    }}
                    className="w-full p-2 border rounded"
                  >
                    <option value="">Default value</option>
                    <option value="type_value">Type value</option>
                    {csvColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>

                  {entry.source === "typed" && (
                    <>
                      {type === "boolean" ? (
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={entry.value === "true"}
                            onChange={(e) =>
                              handleTypedValueChange(
                                e.target.checked.toString()
                              )
                            }
                          />
                          <span>True / False</span>
                        </div>
                      ) : type === "number" ? (
                        <input
                          type="number"
                          min={0}
                          className="w-full p-2 border rounded mt-2"
                          value={
                            typeof entry.value === "string" ||
                            typeof entry.value === "number"
                              ? entry.value
                              : ""
                          }
                          onChange={(e) =>
                            handleTypedValueChange(
                              Math.max(Number(e.target.value))
                            )
                          }
                        />
                      ) : (
                        <input
                          type="text"
                          className="w-full p-2 border rounded mt-2"
                          placeholder={`Type a value for ${label.toLowerCase()}`}
                          value={
                            typeof entry.value === "string" ||
                            typeof entry.value === "number"
                              ? entry.value
                              : ""
                          }
                          onChange={(e) =>
                            handleTypedValueChange(e.target.value)
                          }
                        />
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    )}
  </div>
);

export default FixationConfig;
