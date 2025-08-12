// src/components/Plugin.tsx
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { useState, useEffect, useRef } from "react";
import useTrials from "../../../../hooks/useTrials";
import { usePluginParameters } from "../../hooks/usePluginParameters";

type Props = { pluginName: string };

type ColumnValueType = "csv" | "typed" | "none";

type coordinates = { x: number; y: number };

type ColumnMappingEntry = {
  source: ColumnValueType;
  value: string | number | boolean | any[] | coordinates | undefined | null; // for csv column or typed value
};

type ColumnMapping = Record<string, ColumnMappingEntry>;

function PluginConfig({ pluginName }: Props) {
  // Basic trial configuration
  const { trials, setTrials, selectedTrial, setSelectedTrial } = useTrials();
  const [trialName, setTrialName] = useState<string>("");
  const [repetitions, setRepetitions] = useState<number>(1);
  const [randomize, setRandomize] = useState<Boolean>(false);
  const [includeFixation, setIncludeFixation] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);

  const [csvJson, setCsvJson] = useState<any[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);

  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const { parameters, data } = usePluginParameters(pluginName);

  // Subir CSV
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();

    if (fileName.endsWith(".csv")) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setCsvJson(results.data);
          if (results.data.length > 0) {
            setCsvColumns(Object.keys(results.data[0] as Record<string, any>));
          }
        },
        error: (err) => {
          alert("Error at reading the CSV: " + err.message);
        },
      });
    } else if (fileName.endsWith(".xlsx")) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = evt.target?.result;
        if (!data) return;
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        setCsvJson(json);
        if (json.length > 0) {
          setCsvColumns(Object.keys(json[0] as Record<string, any>));
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      alert("Not supported format. Upload a .csv o .xlsx file");
    }
  };

  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute("webkitdirectory", "");
    }
  }, []);

  // Upload file
  const handleSingleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // upload file automatically
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("/api/upload-file", {
          method: "POST",
          body: formData,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Error at file upload");

        // Actualiza el trial global si es necesario
        if (selectedTrial) {
          const updatedTrial = { ...selectedTrial };
          setTrials(
            trials.map((t) => (t.id === selectedTrial.id ? updatedTrial : t))
          );
          setSelectedTrial(updatedTrial);
        }
        refreshUploadedFiles();
      } catch (err) {
        alert("Error at file upload");
        console.error(err);
      }
    }
  };

  // Subir carpeta de files
  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append("files", file);
    });

    try {
      const response = await fetch("/api/upload-files-folder", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Error at uploading files");

      // Para carpeta:
      if (data.filePaths && data.filePaths.length > 0) {
        // Actualiza el trial global si es necesario
        if (selectedTrial) {
          const updatedTrial = { ...selectedTrial };
          setTrials(
            trials.map((t) => (t.id === selectedTrial.id ? updatedTrial : t))
          );
          setSelectedTrial(updatedTrial);
        }
      }
      refreshUploadedFiles();
    } catch (err) {
      alert("Error at uploading files");
      console.error(err);
    }
  };

  useEffect(() => {
    fetch("/api/list-files")
      .then((res) => res.json())
      .then((data) => setUploadedFiles(data.files));
  }, []);

  const refreshUploadedFiles = () => {
    fetch("/api/list-files")
      .then((res) => res.json())
      .then((data) => setUploadedFiles(data.files));
  };

  // Persistir/traer datos del trial
  useEffect(() => {
    if (selectedTrial) {
      setTrialName(selectedTrial.name || "");
      setIncludeFixation(
        selectedTrial.parameters?.include_fixation !== undefined
          ? !!selectedTrial.parameters.include_fixation
          : includeFixation
      );
      // Restaura CSV y columnas si existen
      setColumnMapping(selectedTrial.columnMapping || {});
      setCsvJson(selectedTrial.csvJson || []);
      setCsvColumns(selectedTrial.csvColumns || []);
    }
    // eslint-disable-next-line
  }, [selectedTrial]);

  //Asignar defaults para los parámetros
  const getDefaultValueForKey = (key: string): any => {
    for (const group of Object.values(fieldGroups)) {
      const field = group.find((f) => f.key === key);
      if (field && "default" in field) {
        return field.default;
      }
    }
    return "";
  };

  // capturar los valores de los inputs para asignarlos a los parámetros
  const getColumnValue = (
    mapping: ColumnMappingEntry | undefined,
    row?: Record<string, any>,
    defaultValue?: any,
    key?: string
  ) => {
    if (!mapping || mapping.source === "none")
      return defaultValue ?? (key ? getDefaultValueForKey(key) : "");
    if (mapping.source === "typed")
      return mapping.value ?? (key ? getDefaultValueForKey(key) : "");
    if (mapping.source === "csv" && row) {
      const columnKey = mapping.value;
      if (typeof columnKey === "string" || typeof columnKey === "number") {
        return row[columnKey] ?? (key ? getDefaultValueForKey(key) : "");
      } else {
        return key ? getDefaultValueForKey(key) : "";
      }
    }
    return defaultValue ?? (key ? getDefaultValueForKey(key) : "");
  };

  // prefijo img/ para los arhivos de las files
  const prependImgPrefix = (value: string | undefined): string | undefined => {
    if (!value) return undefined;
    return `img/${value.replace(/^\/?img\//, "")}`;
  };

  // parámetros mapeados de los plugins
  const fieldGroups = {
    pluginParameters: parameters,
    fixation: [
      { label: "Fixation", key: "fixation", type: "string" },
      {
        label: "Fixation Duration",
        key: "fixation_duration",
        type: "number",
        default: 500,
      },
    ],
  };

  const mappedJson = (() => {
    const mapRow = (row?: Record<string, any>, idx?: number) => {
      const result: Record<string, any> = {};

      parameters.forEach((param) => {
        const { key } = param;

        if (key === "stimulus") {
          const val = getColumnValue(columnMapping[key], row, undefined, key);
          result[key] =
            prependImgPrefix(val) ??
            (uploadedFiles[idx ?? 0]
              ? prependImgPrefix(uploadedFiles[idx ?? 0])
              : undefined);
        } else {
          result[key] = getColumnValue(columnMapping[key], row, undefined, key);
        }
      });

      return result;
    };

    if (csvJson.length > 0) {
      return csvJson.map((row, idx) => mapRow(row, idx));
    } else if (uploadedFiles.length > 0) {
      return uploadedFiles.map((_, idx) => mapRow(undefined, idx));
    } else {
      return [mapRow()];
    }
  })();

  // Generación del template del trial/ensayo
  const generateTrialProps = (params: any[], data: any): string => {
    const paramProps = params
      .map(({ key }: { key: string }) => {
        return `${key}: jsPsych.timelineVariable("${key}"),`;
      })
      .join("\n");

    const dataProps = data
      .map(({ key }: { key: string }) => {
        return `${key}: "${key}",`;
      })
      .join("\n");

    return `${paramProps}
    data: {
      ${dataProps}
    },`;
  };

  function toCamelCase(str: string): string {
    return str
      .replace(/^plugin-/, "") // elimina el prefijo "plugin-"
      .split("-") // divide el string por guiones
      .map((word, index) =>
        index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
      )
      .join("");
  }

  const pluginNameImport = toCamelCase(pluginName);

  const genTrialCode = () => {
    const trialNameSanitized = trialName.replace(/\s+/g, "_");
    let code = `
    const preload${trialNameSanitized} = {
        type: jsPsychPreload,
       files: ${JSON.stringify(uploadedFiles)},
    }
    timeline.push(preload${trialNameSanitized});
    const test_stimuli${trialNameSanitized} = ${JSON.stringify(
      mappedJson
    )};\n\n`;

    if (includeFixation) {
      code += `const ${trialNameSanitized}_fixation = {
      type: htmlKeyboardResponse,
      stimulus: jsPsych.timelineVariable("fixation"),
      choices: "NO_KEYS",
      trial_duration: jsPsych.timelineVariable("fixation_duration"),
      data: {
        task: "fixation",
      },
    };\n\n`;
    }

    const timelineProps = generateTrialProps(parameters, data);

    code += `const ${trialNameSanitized}_timeline = {
    type: ${pluginNameImport},
    ${timelineProps}
    };\n\n`;

    code += `const ${trialNameSanitized}_procedure = {
    timeline: 
    [${
      includeFixation ? `${trialNameSanitized}_fixation, ` : ""
    }${trialNameSanitized}_timeline],
    timeline_variables: test_stimuli${trialNameSanitized},
    repetitions: ${repetitions},
    randomize_order: ${randomize}
  };
  timeline.push(${trialNameSanitized}_procedure);
  jsPsych.data.getLastTrialData().json`;

    return code;
  };

  // guardar y actualizar el estado global del ensayo
  const handleSave = () => {
    const trialIndex = trials.findIndex((t) => t.name === trialName);
    if (trialIndex === -1) return;

    const updatedTrial = {
      ...trials[trialIndex],
      plugin: pluginName,
      parameters: {
        include_fixation: includeFixation,
      },
      trialCode: genTrialCode(),
      columnMapping: { ...columnMapping },
      csvJson: [...csvJson],
      csvColumns: [...csvColumns],
    };

    const updatedTrials = [...trials];
    updatedTrials[trialIndex] = updatedTrial;
    setTrials(updatedTrials);
    setSelectedTrial(updatedTrial);

    window.alert("Ensayo guardado exitosamente.");
    console.log(csvJson);
    console.log(mappedJson);
  };

  // guardar en la base de datos el trial/ensayo
  useEffect(() => {
    const saveTrials = async () => {
      try {
        const savedTrials = { trials };
        const response = await fetch("/api/save-trials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(savedTrials),
          credentials: "include",
          mode: "cors",
        });
        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }
      } catch (error) {
        console.error("Error saving trial:", error);
      }
    };
    if (trials.length > 0) {
      saveTrials();
    }
  }, [trials]);

  // borrar el trial de la base de datos
  const deleteTrial = async (id: number) => {
    try {
      const response = await fetch(`/api/trials/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
    } catch (error) {
      console.error("Error deleting trial:", error);
    }
  };

  // borrar el trial del estado global
  const handleDeleteTrial = () => {
    if (!selectedTrial) return;
    const updatedTrials = trials.filter((t) => t.id !== selectedTrial.id);
    setTrials(updatedTrials);
    setSelectedTrial(null);
    deleteTrial(selectedTrial.id);
  };

  // manejo para guardar trial
  const isTyped = (field?: ColumnMappingEntry) =>
    field?.source === "typed" &&
    typeof field.value === "string" &&
    field.value.trim() !== "";

  const isCsv = (field?: ColumnMappingEntry) =>
    field?.source === "csv" &&
    typeof field.value === "string" &&
    field.value.trim() !== "";

  const hasStimulus =
    isTyped(columnMapping.stimulus) ||
    isCsv(columnMapping.stimulus) ||
    (columnMapping.stimulus?.source === "none" && uploadedFiles.length > 0);

  const canSave = !!trialName && hasStimulus;

  return (
    <div id="plugin-config">
      <div className="mb-1 input-section p-4 border rounded">
        <h4 className="text-lg font-bold mb-3"> {pluginName} </h4>
        {/* Trial name */}
        <div className="mb-4">
          <label className="block mb-1 font-medium">Test name:</label>
          <input
            type="text"
            value={trialName}
            onChange={(e) => {
              const newName = e.target.value;
              // Verifica si el nombre ya existe en otros ensayos
              const nameExists = trials.some(
                (t) => t.name === newName && t.id !== selectedTrial?.id
              );
              if (nameExists) {
                alert("Ya existe un ensayo con ese nombre. Elige otro.");
                return;
              }
              setTrialName(newName);

              // Actualiza el nombre en el contexto global
              if (selectedTrial) {
                const updatedTrial = { ...selectedTrial, name: newName };
                setTrials(
                  trials.map((t) =>
                    t.id === selectedTrial.id ? updatedTrial : t
                  )
                );
                setSelectedTrial(updatedTrial);
              }
            }}
            onFocus={() => {
              // Si el nombre es el default, bórralo al enfocar
              if (trialName === "New Trial") {
                setTrialName("");
                if (selectedTrial) {
                  const updatedTrial = { ...selectedTrial, name: "" };
                  setTrials(
                    trials.map((t) =>
                      t.id === selectedTrial.id ? updatedTrial : t
                    )
                  );
                  setSelectedTrial(updatedTrial);
                }
              }
            }}
            className="w-full p-2 border rounded"
          />
        </div>

        {/* CSV and XLSX section */}
        <div className="mb-4 p-4 border rounded bg-gray-50">
          <h4 className="font-bold mb-3">CSV or XLSX</h4>
          <label className="block mb-1 font-medium">
            Upload .csv or .xlsx file:
          </label>
          <input type="file" accept=".csv, .xlsx" onChange={handleCsvUpload} />{" "}
        </div>

        {/* File section */}
        <div className="mb-4 p-4 border rounded bg-gray-50">
          <h4 className="font-bold mb-3">File</h4>
          <div className="mb-4">
            <label className="block mb-1 font-medium">
              Upload single file:
            </label>
            <input
              ref={fileInputRef}
              className="mb-1"
              type="file"
              accept="image/*" // investigar los tipos de archivos aceptados
              onChange={handleSingleFileUpload}
            />{" "}
            <label className="block mt-2 mb-1 font-medium">
              Upload file folder:
            </label>
            <input
              ref={folderInputRef}
              type="file"
              accept="image/*" // investigar los tipos de archivos aceptados
              multiple
              onChange={handleFolderUpload}
            />
            {/* files subidos */}
            <div className="mt-4">
              {uploadedFiles.length > 0 && (
                <>
                  <h4
                    className="mb-4 font-bold text-center"
                    style={{ color: "#fff" }}
                  >
                    Uploaded files
                  </h4>
                  <ul style={{ padding: 0, margin: 0 }}>
                    {uploadedFiles.map((file) => (
                      <li
                        key={file}
                        style={{
                          listStyle: "none",
                          display: "flex",
                          alignItems: "center",
                          background: "#111",
                          border: "1px solid #444",
                          borderRadius: "6px",
                          padding: "8px 12px",
                          marginBottom: "8px",
                          fontSize: "15px",
                          fontWeight: 500,
                          color: "#fff",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
                        }}
                      >
                        <span
                          style={{
                            flex: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            color: "#fff",
                          }}
                          title={file.split("/").pop()}
                        >
                          {file.split("/").pop()}
                        </span>
                        <button
                          style={{
                            marginLeft: "12px",
                            background: "transparent",
                            color: "#FFD700", // gold
                            border: "none",
                            borderRadius: "50%",
                            width: "26px",
                            height: "26px",
                            cursor: "pointer",
                            fontWeight: "bold",
                            fontSize: "20px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "background 0.2s",
                          }}
                          title="Delete file"
                          onClick={async () => {
                            const filename = file.split("/").pop();
                            await fetch(`/api/delete-file/${filename}`, {
                              method: "DELETE",
                            });
                            setUploadedFiles((prev) => {
                              const updated = prev.filter((i) => i !== file);
                              if (updated.length === 0) {
                                if (folderInputRef.current)
                                  folderInputRef.current.value = "";
                                if (fileInputRef.current)
                                  fileInputRef.current.value = "";
                              }
                              return updated;
                            });
                          }}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            <div className="mt-4">
              <div className="mt-4">
                <h4 className="mt-3 mb-0 text-center">File parameters</h4>
                <div className="grid grid-cols-2 gap-2">
                  {fieldGroups.pluginParameters.map(({ label, key, type }) => {
                    // console.log(JSON.stringify(fieldGroups.pluginParameters));
                    const entry = columnMapping[key as keyof ColumnMapping] || {
                      source: "none",
                    };

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
                                value:
                                  source === "typed"
                                    ? type === "boolean"
                                      ? false
                                      : type === "number"
                                      ? 0
                                      : type.endsWith("_array")
                                      ? []
                                      : type === "coordinates" &&
                                        key === "coordinates"
                                      ? { x: 0, y: 0 }
                                      : ""
                                    : value,
                              },
                            }));
                          }}
                          className="w-full p-2 border rounded"
                        >
                          <option value="">No value</option>
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
                              <select
                                className="mt-2 p-2 border rounded"
                                value={entry.value === true ? "true" : "false"}
                                onChange={(e) =>
                                  handleTypedValueChange(
                                    e.target.value === "true"
                                  )
                                }
                              >
                                <option value="true">True</option>
                                <option value="false">False</option>
                              </select>
                            ) : type === "number" ? (
                              <input
                                type="number"
                                min={0}
                                step="any"
                                className="w-full p-2 border rounded mt-2"
                                value={
                                  typeof entry.value === "string" ||
                                  typeof entry.value === "number"
                                    ? entry.value
                                    : ""
                                }
                                onChange={(e) => {
                                  const rawValue = Number(e.target.value);
                                  const clampedValue = rawValue;

                                  handleTypedValueChange(clampedValue);
                                }}
                              />
                            ) : type.endsWith("_array") ? (
                              <input
                                type="text"
                                className="w-full p-2 border rounded mt-2"
                                placeholder={`Comma-separated values for ${label.toLowerCase()}`}
                                value={
                                  typeof entry.value === "string"
                                    ? entry.value
                                    : Array.isArray(entry.value)
                                    ? entry.value.join(", ")
                                    : ""
                                }
                                onChange={(e) => {
                                  handleTypedValueChange(e.target.value);
                                }}
                                onBlur={(e) => {
                                  const input = e.target.value.trim();
                                  const rawItems = input
                                    .split(",")
                                    .map((item) => item.trim())
                                    .filter((item) => item.length > 0);

                                  const baseType = type.replace(/_array$/, "");

                                  const castedArray = rawItems.map((item) => {
                                    switch (baseType) {
                                      case "number":
                                      case "int":
                                      case "float":
                                        if (
                                          item === "" ||
                                          isNaN(Number(item))
                                        ) {
                                          return item;
                                        }
                                        return Number(item);

                                      case "boolean":
                                      case "bool":
                                        const lower = item.toLowerCase();
                                        if (lower === "true") return true;
                                        if (lower === "false") return false;

                                        return item;

                                      default:
                                        return item;
                                    }
                                  });

                                  handleTypedValueChange(castedArray);
                                }}
                              />
                            ) : type === "coordinates" &&
                              key === "coordinates" ? (
                              <>
                                <label className="block mt-2">x:</label>
                                <input
                                  type="number"
                                  min={-1}
                                  max={1}
                                  step="any"
                                  className="w-full p-2 border rounded mt-1"
                                  value={
                                    entry.value &&
                                    typeof entry.value === "object" &&
                                    "x" in entry.value &&
                                    typeof (entry.value as any).x === "number"
                                      ? (entry.value as any).x
                                      : 0
                                  }
                                  onChange={(e) => {
                                    const rawValue = Number(e.target.value);
                                    const clampedValue = Math.max(
                                      -1,
                                      Math.min(1, rawValue)
                                    );
                                    handleTypedValueChange({
                                      ...(entry.value &&
                                      typeof entry.value === "object" &&
                                      "x" in entry.value &&
                                      "y" in entry.value
                                        ? entry.value
                                        : { x: 0, y: 0 }),
                                      x: clampedValue,
                                    });
                                  }}
                                />

                                <label className="block mt-2">y:</label>
                                <input
                                  type="number"
                                  min={-1}
                                  max={1}
                                  step="any"
                                  className="w-full p-2 border rounded mt-1"
                                  value={
                                    entry.value &&
                                    typeof entry.value === "object" &&
                                    "y" in entry.value &&
                                    typeof (entry.value as any).y === "number"
                                      ? (entry.value as any).y
                                      : 0
                                  }
                                  onChange={(e) => {
                                    const rawValue = Number(e.target.value);
                                    const clampedValue = Math.max(
                                      -1,
                                      Math.min(1, rawValue)
                                    );
                                    handleTypedValueChange({
                                      ...(entry.value &&
                                      typeof entry.value === "object" &&
                                      "x" in entry.value &&
                                      "y" in entry.value
                                        ? entry.value
                                        : { x: 0, y: 0 }),
                                      y: clampedValue,
                                    });
                                  }}
                                />
                              </>
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
          </div>
        </div>

        {/* Fixation point */}
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
                  {fieldGroups.fixation.map(({ label, key, type }) => {
                    const entry = columnMapping[key as keyof ColumnMapping] || {
                      source: "none",
                    };

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
                          <option value="">No value</option>
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

        {/* Repetitions y Randomize */}
        <div className="mb-2 p-4 border rounded bg-gray-50">
          <div className="flex items-center">
            {" "}
            <label className="font-bold">Repetitions</label>
            <input
              type="number"
              value={repetitions}
              min={1}
              step={1}
              onChange={(e) => {
                const val = Math.max(
                  1,
                  Math.floor(Number(e.target.value)) || 1
                );
                setRepetitions(val);
              }}
              className="mr-2"
              placeholder="1"
            />
          </div>
          <div className="mt-3 mb-3 flex items-center">
            <label className="font-bold">Randomize</label>
            <input
              type="checkbox"
              onChange={(e) => setRandomize(Boolean(e.target.value) || false)}
              className="mr-2"
            />
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="mt-8 gap-6 justify-center">
        <button
          onClick={handleSave}
          className="mt-4 save-button mb-4 w-full p-3 bg-green-600 hover:bg-green-700 font-medium rounded"
          disabled={!canSave}
        >
          Save trial
        </button>
        <br />{" "}
        <button
          onClick={() => {
            if (window.confirm("Are you sure on deleting this trial?")) {
              handleDeleteTrial();
            }
          }}
          className="w-full p-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded remove-button"
        >
          Delete trial
        </button>
      </div>
    </div>
  );
}

export default PluginConfig;
