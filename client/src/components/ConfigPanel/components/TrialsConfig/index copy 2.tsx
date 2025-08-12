// src/components/Plugin.tsx
import { useState, useEffect } from "react";
import useTrials from "../../../../hooks/useTrials";
import { usePluginParameters } from "../../hooks/usePluginParameters";
import FileUploader from "./components/FileUploader";
import TrialMetaConfig from "./components/TrialMetaConfig";
import CsvUploader from "./components/CsvUploader";
import ParameterMapper from "./components/ParameterMapper";
import FixationConfig from "./components/FixationConfig";
import TrialActions from "./components/TrialActions";
import { useFileUpload } from "./hooks/useFileUpload";
import { useCsvData } from "./hooks/useCsvData";
import { useTrialPersistence } from "./hooks/useTrialPersistence";
import { useColumnMapping } from "./hooks/useColumnMapping";
import { useCsvMapper } from "./hooks/useCsvMapper";
import type { ColumnMappingEntry } from "../../types";

type Props = { pluginName: string };

function PluginConfig({ pluginName }: Props) {
  // Basic trial configuration
  const { trials, setTrials, selectedTrial, setSelectedTrial } = useTrials();
  const [trialName, setTrialName] = useState<string>("");
  const [repetitions, setRepetitions] = useState<number>(1);
  const [randomize, setRandomize] = useState<boolean>(false);
  const [includeFixation, setIncludeFixation] = useState<boolean>(false);

  const { csvJson, setCsvJson, csvColumns, setCsvColumns, handleCsvUpload } =
    useCsvData();

  const { columnMapping, setColumnMapping } = useColumnMapping({});
  const { parameters, data } = usePluginParameters(pluginName);

  const needsFileUpload =
    /plugin-audio|plugin-video|plugin-image|multi-image|plugin-preload/i.test(
      pluginName
    );

  const getFileTypeAndFolder = () => {
    if (/plugin-audio/i.test(pluginName)) {
      return { accept: "audio/*", folder: "aud" };
    }
    if (/plugin-video/i.test(pluginName)) {
      return { accept: "video/*", folder: "vid" };
    }
    // Por defecto imagen
    return { accept: "image/*", folder: "img" };
  };

  const { accept, folder } = getFileTypeAndFolder();

  const {
    fileInputRef,
    folderInputRef,
    uploadedFiles,

    handleSingleFileUpload,
    handleFolderUpload,
    handleDeleteFile,
  } = useFileUpload({
    selectedTrial,
    setTrials,
    trials,
    setSelectedTrial,
    folder,
  });

  const filteredFiles = uploadedFiles.filter(
    (file) =>
      file &&
      typeof file === "object" &&
      typeof file.name === "string" &&
      file.name.startsWith(`${folder}/`)
  );

  const { handleDeleteTrial } = useTrialPersistence({
    trials,
    setTrials,
    selectedTrial,
    setSelectedTrial,
  });

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
  // const getDefaultValueForKey = (key: string): any => {
  //   for (const group of Object.values(fieldGroups)) {
  //     const field = group.find((f) => f.key === key);
  //     if (field && "default" in field) {
  //       return field.default;
  //     }
  //   }
  //   return "";
  // };

  // // // capturar los valores de los inputs para asignarlos a los parámetros
  // const getColumnValue = (
  //   mapping: ColumnMappingEntry | undefined,
  //   row?: Record<string, any>,
  //   defaultValue?: any,
  //   key?: string
  // ) => {
  //   if (!mapping || mapping.source === "none")
  //     return defaultValue ?? (key ? getDefaultValueForKey(key) : "");
  //   if (mapping.source === "typed")
  //     return mapping.value ?? (key ? getDefaultValueForKey(key) : "");
  //   if (mapping.source === "csv" && row) {
  //     const columnKey = mapping.value;
  //     if (typeof columnKey === "string" || typeof columnKey === "number") {
  //       return row[columnKey] ?? (key ? getDefaultValueForKey(key) : "");
  //     } else {
  //       return key ? getDefaultValueForKey(key) : "";
  //     }
  //   }
  //   return defaultValue ?? (key ? getDefaultValueForKey(key) : "");
  // };

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

  const { getColumnValue } = useCsvMapper({
    parameters: parameters,
    fieldGroups: fieldGroups,
  });

  const mappedJson = (() => {
    const mapRow = (row?: Record<string, any>, idx?: number) => {
      const result: Record<string, any> = {};

      parameters.forEach((param) => {
        const { key } = param;

        // if (key === "stimulus") {
        //   const val = getColumnValue(columnMapping[key], row, undefined, key);

        //   // Si el usuario puso un nombre de archivo (ej: green.png), busca la URL
        //   if (val && typeof val === "string" && !/^https?:\/\//.test(val)) {
        //     // Busca en filteredFiles por nombre
        //     const found = filteredFiles.find((f) => f.name.endsWith(val));
        //     result[key] = found ? found.url : val; // Usa la URL si existe, si no deja el valor original
        //   } else {
        //     // Si ya es URL o está vacío
        //     result[key] = val ?? filteredFiles[idx ?? 0]?.url ?? "";
        //   }
        // } else {
        //   result[key] = getColumnValue(columnMapping[key], row, undefined, key);
        // }

        const mediaKeys = ["stimulus", "images", "audio", "video"];

        if (mediaKeys.includes(key) && needsFileUpload) {
          const val = getColumnValue(columnMapping[key], row, undefined, key);

          let stimulusValue;
          if (Array.isArray(val)) {
            // Si es un array, procesar cada valor individualmente
            stimulusValue = val.map((v) => {
              if (v && !/^https?:\/\//.test(v)) {
                const found = filteredFiles.find((f) => f.name.endsWith(v));
                return found ? found.url : v;
              } else {
                return v ?? "";
              }
            });
          } else {
            if (val && !/^https?:\/\//.test(val)) {
              const found = filteredFiles.find((f) => f.name.endsWith(val));
              stimulusValue = found ? found.url : val;
            } else {
              stimulusValue = val ?? filteredFiles[idx ?? 0]?.url ?? "";
            }
          }

          // Si es video, envolver en array
          // result[key] = isVideoPlugin ? [stimulusValue] : stimulusValue;
          result[key] = stimulusValue;
        } else {
          result[key] = getColumnValue(columnMapping[key], row, undefined, key);
        }
      });

      if (includeFixation) {
        fieldGroups.fixation.forEach((fixParam) => {
          result[fixParam.key] = getColumnValue(
            columnMapping[fixParam.key],
            row,
            fixParam.default,
            fixParam.key
          );
        });
      }

      return result;
    };

    if (csvJson.length > 0) {
      return csvJson.map((row, idx) => mapRow(row, idx));
      // } else if (needsFileUpload && filteredFiles.length > 0) {
      //   return filteredFiles.map((_, idx) => mapRow(undefined, idx));
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
      .replace(/^plugin/, "jsPsych") // elimina el prefijo "plugin-" y agrega "jsPsych"
      .split("-") // divide el string por guiones
      .map((word, index) =>
        index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
      )
      .join("");
  }

  const pluginNameImport = toCamelCase(pluginName);

  function stringifyWithFunctions(
    params: { key: string; type: string }[],
    values: Record<string, any>
  ) {
    const allKeys = [
      ...params.map((p) => p.key),
      ...Object.keys(values).filter((k) => !params.some((p) => p.key === k)),
    ];
    return (
      "{" +
      allKeys
        .map((key) => {
          const val = values[key];
          // Si es función, no poner comillas
          if (
            params.find((p) => p.key === key)?.type === "function" &&
            typeof val === "string" &&
            val.trim()
          ) {
            return `${key}: ${val}`;
          }
          return `${key}: ${JSON.stringify(val)}`;
        })
        .join(",\n") +
      "}"
    );
  }

  const genTrialCode = () => {
    const trialNameSanitized = trialName.replace(/\s+/g, "_");

    let code = "";

    if (needsFileUpload && pluginName != "plugin-preload") {
      code += `
    const preload${trialNameSanitized} = {
        type: jsPsychPreload,
       files: ${JSON.stringify(filteredFiles.map((f) => f.url))},
    }
    timeline.push(preload${trialNameSanitized});
    `;
    }

    const testStimuliCode = mappedJson.map((row) =>
      stringifyWithFunctions(parameters, row)
    );
    code += `
    const test_stimuli${trialNameSanitized} = [${testStimuliCode.join(",")}];`;

    if (includeFixation) {
      code += `
      const ${trialNameSanitized}_fixation = {
      type: jsPsychHtmlKeyboardResponse,
      stimulus: jsPsych.timelineVariable("fixation"),
      choices: "NO_KEYS",
      trial_duration: jsPsych.timelineVariable("fixation_duration"),
      data: {
        task: "fixation",
      },
    };
    `;
    }

    const timelineProps = generateTrialProps(parameters, data);

    code += `
    const ${trialNameSanitized}_timeline = {
    type: ${pluginNameImport}, ${timelineProps}};
    `;

    code += `
    const ${trialNameSanitized}_procedure = {
    timeline: 
    [${
      includeFixation ? `${trialNameSanitized}_fixation, ` : ""
    }${trialNameSanitized}_timeline],
    timeline_variables: test_stimuli${trialNameSanitized},
    repetitions: ${repetitions},
    randomize_order: ${randomize}
  };
    timeline.push(${trialNameSanitized}_procedure);
  `;

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
    console.log(genTrialCode());
  };

  const deleteCsv = () => {
    if (csvJson.length === 0) return;
    setCsvJson([]);
    setCsvColumns([]);
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
    filteredFiles.length > 0;

  const canSave = !!trialName && hasStimulus;

  return (
    <div id="plugin-config">
      <div className="mb-1 input-section p-4 border rounded">
        <h4 className="text-lg font-bold mb-3"> {pluginName} </h4>
        {/* Trial name */}
        <TrialMetaConfig
          trialName={trialName}
          setTrialName={setTrialName}
          trials={trials}
          selectedTrial={selectedTrial}
          setTrials={setTrials}
          setSelectedTrial={setSelectedTrial}
        />

        {/* CSV and XLSX section */}
        <CsvUploader
          onCsvUpload={handleCsvUpload}
          csvJson={csvJson}
          onDeleteCSV={deleteCsv}
        />

        {/* File section */}
        {needsFileUpload && (
          <div className="mb-4">
            <FileUploader
              uploadedFiles={filteredFiles}
              onSingleFileUpload={handleSingleFileUpload}
              onFolderUpload={handleFolderUpload}
              onDeleteFile={handleDeleteFile}
              fileInputRef={fileInputRef}
              folderInputRef={folderInputRef}
              accept={accept}
            />
          </div>
        )}
        {/* Parameter section */}

        <ParameterMapper
          parameters={fieldGroups.pluginParameters}
          columnMapping={columnMapping}
          setColumnMapping={setColumnMapping}
          csvColumns={csvColumns}
        />

        {/* Fixation point */}
        <FixationConfig
          includeFixation={includeFixation}
          setIncludeFixation={setIncludeFixation}
          fixationFields={fieldGroups.fixation}
          columnMapping={columnMapping}
          setColumnMapping={setColumnMapping}
          csvColumns={csvColumns}
        />

        {/* Repetitions y Randomize al final */}
        <div className="mb-2 p-4 border rounded bg-gray-50">
          <div className="flex items-center">
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
              checked={randomize}
              onChange={(e) => setRandomize(e.target.checked)}
              className="ml-2"
            />
          </div>
        </div>
      </div>

      {/* Save button */}
      <TrialActions
        onSave={handleSave}
        onDelete={handleDeleteTrial}
        canSave={canSave}
      />
    </div>
  );
}

export default PluginConfig;
