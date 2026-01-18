import React from "react";
import Switch from "react-switch";

type InstructionField = {
  label: string;
  key: string;
  type: string;
};

type ColumnMappingEntry = {
  source: "csv" | "typed" | "none";
  value: any;
};

type InstructionsConfigProps = {
  includeInstructions: boolean;
  setIncludeInstructions: (b: boolean) => void;
  instructionsFields: InstructionField[];
  columnMapping: Record<string, ColumnMappingEntry>;
  setColumnMapping: React.Dispatch<
    React.SetStateAction<Record<string, ColumnMappingEntry>>
  >;
  csvColumns: string[];
  onSave?: (key: string, value: unknown) => Promise<void>;
};

const InstructionsConfig: React.FC<InstructionsConfigProps> = ({
  includeInstructions,
  setIncludeInstructions,
  instructionsFields,
  columnMapping,
  setColumnMapping,
  csvColumns,
  onSave,
}) => {
  // Estado local para inputs de texto (patrón de ParameterMapper)
  const [localInputValues, setLocalInputValues] = React.useState<
    Record<string, string>
  >({});

  return (
    <div className="mb-4 p-4 border rounded bg-gray-50">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "12px",
        }}
      >
        <Switch
          checked={includeInstructions}
          onChange={(checked) => setIncludeInstructions(checked)}
          onColor="#3d92b4"
          onHandleColor="#ffffff"
          handleDiameter={24}
          uncheckedIcon={false}
          checkedIcon={false}
          height={20}
          width={44}
          id="includeInstructions"
        />
        <label
          htmlFor="includeInstructions"
          className="font-bold"
          style={{ margin: 0 }}
        >
          Include instructions
        </label>
      </div>

      {includeInstructions && (
        <div className="pl-6">
          <div>
            <h5 className="mt-3 mb-0">Instruction Parameters</h5>
            <div className="grid grid-cols-2 gap-2">
              {instructionsFields.map(({ label, key, type }) => {
                const entry = columnMapping[key] || { source: "none" };

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
                            ? ("typed" as const)
                            : value === ""
                              ? ("none" as const)
                              : ("csv" as const);

                        const newMapping = {
                          source,
                          value: source === "typed" ? "" : value,
                        };

                        setColumnMapping((prev) => ({
                          ...prev,
                          [key]: newMapping,
                        }));

                        // Los selects guardan inmediatamente en onChange
                        if (onSave) {
                          setTimeout(
                            () =>
                              onSave(
                                key,
                                source === "none" ? undefined : newMapping,
                              ),
                            100,
                          );
                        }
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
                            <Switch
                              checked={entry.value === "true"}
                              onChange={(checked) => {
                                const newValue = {
                                  source: "typed" as const,
                                  value: checked.toString(),
                                };
                                setColumnMapping((prev) => ({
                                  ...prev,
                                  [key]: newValue,
                                }));
                                // Los switches guardan inmediatamente en onChange
                                if (onSave) {
                                  setTimeout(() => onSave(key, newValue), 100);
                                }
                              }}
                              onColor="#3d92b4"
                              onHandleColor="#ffffff"
                              handleDiameter={24}
                              uncheckedIcon={false}
                              checkedIcon={false}
                              height={20}
                              width={44}
                            />
                            <span>True / False</span>
                          </div>
                        ) : type === "number" ? (
                          <input
                            type="number"
                            min={0}
                            className="w-full p-2 border rounded mt-2"
                            value={
                              localInputValues[key] ??
                              (typeof entry.value === "string" ||
                              typeof entry.value === "number"
                                ? entry.value
                                : "")
                            }
                            onChange={(e) => {
                              // Solo actualiza el estado local en onChange
                              setLocalInputValues((prev) => ({
                                ...prev,
                                [key]: e.target.value,
                              }));
                            }}
                            onBlur={(e) => {
                              // Guarda en onBlur
                              const numValue = Math.max(
                                0,
                                Number(e.target.value),
                              );
                              const newValue = {
                                source: "typed" as const,
                                value: numValue,
                              };
                              setColumnMapping((prev) => ({
                                ...prev,
                                [key]: newValue,
                              }));
                              if (onSave) {
                                setTimeout(() => onSave(key, newValue), 100);
                              }
                              // Limpia el estado local
                              setLocalInputValues((prev) => {
                                const newState = { ...prev };
                                delete newState[key];
                                return newState;
                              });
                            }}
                          />
                        ) : (
                          <input
                            type="text"
                            className="w-full p-2 border rounded mt-2"
                            placeholder={`Type a value for ${label.toLowerCase()}`}
                            value={
                              localInputValues[key] ??
                              (typeof entry.value === "string" ||
                              typeof entry.value === "number"
                                ? entry.value
                                : "")
                            }
                            onChange={(e) => {
                              // Solo actualiza el estado local en onChange
                              setLocalInputValues((prev) => ({
                                ...prev,
                                [key]: e.target.value,
                              }));
                            }}
                            onBlur={(e) => {
                              // Guarda en onBlur
                              const newValue = {
                                source: "typed" as const,
                                value: e.target.value,
                              };
                              setColumnMapping((prev) => ({
                                ...prev,
                                [key]: newValue,
                              }));
                              if (onSave) {
                                setTimeout(() => onSave(key, newValue), 100);
                              }
                              // Limpia el estado local
                              setLocalInputValues((prev) => {
                                const newState = { ...prev };
                                delete newState[key];
                                return newState;
                              });
                            }}
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
};

export default InstructionsConfig;
