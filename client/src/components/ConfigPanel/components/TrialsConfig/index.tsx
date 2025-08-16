// src/components/Plugin.tsx
import { useState, useEffect, useRef } from "react";
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
import { useTrialCode } from "./hooks/useTrialCode";
import { useExtensions } from "./hooks/useExtensions";
import ExtensionsConfig from "./components/ExtensionsConfig";
import isEqual from "lodash.isequal";

type Props = { pluginName: string };

function TrialsConfig({ pluginName }: Props) {
  // Basic trial configuration
  const { trials, setTrials, selectedTrial, setSelectedTrial } = useTrials();
  const [trialName, setTrialName] = useState<string>("");
  const [repetitions, setRepetitions] = useState<number>(1);
  const [randomize, setRandomize] = useState<boolean>(false);
  const [includeFixation, setIncludeFixation] = useState<boolean>(false);

  // Autosave
  const [isLoadingTrial, setIsLoadingTrial] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialFileLoad = useRef(false);
  const [saveIndicator, setSaveIndicator] = useState(false);

  const { csvJson, setCsvJson, csvColumns, setCsvColumns, handleCsvUpload } =
    useCsvData();

  const { columnMapping, setColumnMapping } = useColumnMapping({});
  const { parameters, data } = usePluginParameters(pluginName);
  const {
    extensions,
    includesExtensions,
    setIncludeExtensions,
    extensionType,
    setExtensionType,
  } = useExtensions(pluginName, parameters);

  const hasMediaParameters = (params: any[]) => {
    return params.some((param) => {
      const keyLower = param.key.toLowerCase();
      return (
        keyLower.includes("img") ||
        keyLower.includes("image") ||
        keyLower.includes("stimulus") ||
        keyLower.includes("audio") ||
        keyLower.includes("video") ||
        keyLower.includes("sound") ||
        keyLower.includes("media")
      );
    });
  };

  const needsFileUpload =
    /plugin-audio|plugin-video|plugin-image|multi-image|custom-image|plugin-preload/i.test(
      pluginName
    ) || hasMediaParameters(parameters);

  const getFileTypeAndFolder = () => {
    if (/plugin-audio/i.test(pluginName)) {
      return { accept: "audio/*", folder: "aud" };
    }
    if (/plugin-video/i.test(pluginName)) {
      return { accept: "video/*", folder: "vid" };
    }

    if (/plugin-preload/i.test(pluginName)) {
      return { accept: "audio/*,video/*,image/*", folder: "all" };
    }

    // For custom plugins, determine file type based on parameters
    if (hasMediaParameters(parameters)) {
      const hasAudio = parameters.some((p) => {
        const keyLower = p.key.toLowerCase();
        return keyLower.includes("audio") || keyLower.includes("sound");
      });
      const hasVideo = parameters.some((p) => {
        const keyLower = p.key.toLowerCase();
        return keyLower.includes("video");
      });
      const hasImage = parameters.some((p) => {
        const keyLower = p.key.toLowerCase();
        return (
          keyLower.includes("img") ||
          keyLower.includes("image") ||
          keyLower.includes("stimulus")
        );
      });

      // If multiple types, accept all
      if ([hasAudio, hasVideo, hasImage].filter(Boolean).length > 1) {
        return { accept: "audio/*,video/*,image/*", folder: "all" };
      }

      if (hasAudio) return { accept: "audio/*", folder: "aud" };
      if (hasVideo) return { accept: "video/*", folder: "vid" };
      if (hasImage) return { accept: "image/*", folder: "img" };
    }

    // Por defecto imagen
    return { accept: "image/*", folder: "img" };
  };

  const { accept, folder } = getFileTypeAndFolder();

  const {
    fileInputRef,
    folderInputRef,
    uploadedFiles,
    refreshUploadedFiles,
    handleSingleFileUpload,
    handleFolderUpload,
    handleDeleteFile,
  } = useFileUpload({ folder });

  useEffect(() => {
    isInitialFileLoad.current = true;
    refreshUploadedFiles();
  }, [folder, refreshUploadedFiles]);

  const filteredFiles = uploadedFiles.filter(
    (file) =>
      file &&
      typeof file === "object" &&
      typeof file.name === "string" &&
      (folder === "all" || file.name.startsWith(`${folder}/`))
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
      setIsLoadingTrial(true);
      setTrialName(selectedTrial.name || "");
      setIncludeFixation(
        selectedTrial.parameters?.include_fixation !== undefined
          ? !!selectedTrial.parameters.include_fixation
          : includeFixation
      );
      setRepetitions(selectedTrial.parameters?.repetitions || 1);
      setRandomize(selectedTrial.parameters?.randomize || false);
      setIncludeExtensions(
        selectedTrial.parameters?.includesExtensions !== undefined
          ? !!selectedTrial.parameters.includesExtensions
          : includesExtensions
      );
      setExtensionType(selectedTrial.parameters?.extensionType || "");
      // Restaura CSV y columnas si existen
      setColumnMapping(selectedTrial.columnMapping || {});
      setCsvJson(selectedTrial.csvJson || []);
      setCsvColumns(selectedTrial.csvColumns || []);

      setTimeout(() => {
        setIsLoadingTrial(false);
      }, 100);
    }

    // eslint-disable-next-line
  }, [selectedTrial]);

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
    fieldGroups: fieldGroups,
  });

  const { genTrialCode } = useTrialCode({
    pluginName: pluginName,
    parameters: parameters,
    getColumnValue: getColumnValue,
    needsFileUpload: needsFileUpload,
    columnMapping: columnMapping,
    filteredFiles: filteredFiles,
    includeFixation: includeFixation,
    csvJson: csvJson,
    fieldGroups: fieldGroups,
    trialName: trialName,
    data: data,
    repetitions: repetitions,
    randomize: randomize,
    extensions: extensions,
    includesExtensions: includesExtensions,
  });

  // guardar y actualizar el estado global del ensayo

  useEffect(() => {
    if (!trialName || !canSave || isLoadingTrial) return;

    if (isInitialFileLoad.current) {
      isInitialFileLoad.current = false;
      return;
    }

    const trialIndex = trials.findIndex((t) => t.name === trialName);
    if (trialIndex === -1) return;

    const prevTrial = trials[trialIndex];

    const updatedTrial = {
      ...trials[trialIndex],
      plugin: pluginName,
      parameters: {
        include_fixation: includeFixation,
        randomize: randomize,
        repetitions: repetitions,
        includesExtensions: includesExtensions,
        extensionType: extensionType,
      },
      trialCode: genTrialCode(),
      columnMapping: { ...columnMapping },
      csvJson: [...csvJson],
      csvColumns: [...csvColumns],
    };

    if (isEqual(updatedTrial, prevTrial)) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      const updatedTrials = [...trials];
      updatedTrials[trialIndex] = updatedTrial;
      setTrials(updatedTrials);
      setSelectedTrial(updatedTrial);

      // window.alert("Ensayo guardado exitosamente.");
      // console.log(csvJson);
      // console.log(genTrialCode());

      // less intrusve indicator
      setSaveIndicator(true);
      setTimeout(() => {
        setSaveIndicator(false);
      }, 2000);
    }, 1000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [
    pluginName,
    includeFixation,
    randomize,
    repetitions,
    includesExtensions,
    extensionType,
    columnMapping,
    csvJson,
    csvColumns,
    trialName,
    isLoadingTrial,
  ]);

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
      {/* Indicador de guardado */}
      <div
        style={{
          opacity: saveIndicator ? 1 : 0,
          transition: "opacity 0.3s",
          color: "green",
          fontWeight: "500",
          position: "fixed",
          top: "20px",
          right: "20px",
          zIndex: 1000,
          backgroundColor: "rgba(255, 255, 255, 0.9)",
          padding: "6px 12px",
          borderRadius: "4px",
          fontSize: "14px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          border: "1px solid #22c55e",
        }}
      >
        ✓ Saved Trial
      </div>

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
          pluginName={pluginName}
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

        {/* Extensions */}
        <ExtensionsConfig
          parameters={fieldGroups.pluginParameters}
          includesExtensions={includesExtensions}
          setIncludeExtensions={setIncludeExtensions}
          extensionType={extensionType}
          setExtensionType={setExtensionType}
        ></ExtensionsConfig>
      </div>

      <TrialActions onDelete={handleDeleteTrial} />
    </div>
  );
}

export default TrialsConfig;
