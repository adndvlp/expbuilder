// src/components/Plugin.tsx
import { useState, useEffect, useRef } from "react";
import useTrials from "../../../hooks/useTrials";
import { usePluginParameters } from "../hooks/usePluginParameters";
import FileUploader from "./FileUploader";
import TrialMetaConfig from "./TrialMetaConfig";
import CsvUploader from "./CsvUploader";
import ParameterMapper from "./ParameterMapper";
import TrialActions from "./TrialActions";
import { useFileUpload } from "./hooks/useFileUpload";
import { useCsvData } from "./hooks/useCsvData";
import { useTrialPersistence } from "./hooks/useTrialPersistence";
import { useColumnMapping } from "./hooks/useColumnMapping";
import { useCsvMapper } from "./hooks/useCsvMapper";
import { useTrialCode } from "./hooks/useTrialCode";
import { useExtensions } from "./hooks/useExtensions";
import ExtensionsConfig from "./ExtensionsConfig";
import isEqual from "lodash.isequal";
import { Trial } from "../types";
import { useTrialOrders } from "./hooks/useTrialOrders";
import TrialOrders from "./TrialOrders";

type Props = { pluginName: string };

function TrialsConfig({ pluginName }: Props) {
  // Basic trial configuration
  const { trials, setTrials, selectedTrial, setSelectedTrial } = useTrials();
  const [trialName, setTrialName] = useState<string>("");

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
      (folder === "all" || file.type === folder)
  );

  const { handleDeleteTrial } = useTrialPersistence({
    trials,
    setTrials,
    selectedTrial,
    setSelectedTrial,
  });

  function getLoopCsvData(trial: Trial) {
    if (!trial?.csvFromLoop)
      return {
        csvJson: trial?.csvJson || [],
        csvColumns: trial?.csvColumns || [],
      };

    // Recursive function to find parent loop containing the trial
    const findParentLoop = (items: any[], targetId: string | number): any => {
      for (const item of items) {
        if ("trials" in item && Array.isArray(item.trials)) {
          // Check if this loop contains the target trial
          if (
            item.trials.some(
              (t: any) => t.id === targetId || String(t.id) === String(targetId)
            )
          ) {
            return item;
          }
          // Check recursively in nested loops
          const found = findParentLoop(item.trials, targetId);
          if (found) return found;
        }
      }
      return null;
    };

    const parentLoop = findParentLoop(trials, trial.id);

    if (parentLoop) {
      return {
        csvJson: parentLoop.csvJson || [],
        csvColumns: parentLoop.csvColumns || [],
      };
    }
    return {
      csvJson: trial?.csvJson || [],
      csvColumns: trial?.csvColumns || [],
    };
  }

  const {
    orders,
    setOrders,
    orderColumns,
    setOrderColumns,
    mapOrdersFromCsv,
    stimuliOrders,
    setStimuliOrders,
    categories,
    setCategories,
    categoryColumn,
    setCategoryColumn,
    categoryData,
    mapCategoriesFromCsv,
  } = useTrialOrders();

  // Persistir/traer datos del trial
  useEffect(() => {
    if (selectedTrial) {
      setIsLoadingTrial(true);
      setTrialName(selectedTrial.name || "");
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

      // Csv loop
      const { csvJson: effectiveCsvJson, csvColumns: effectiveCsvColumns } =
        getLoopCsvData(selectedTrial);
      setCsvJson(effectiveCsvJson);
      setCsvColumns(effectiveCsvColumns);

      setOrders(selectedTrial.orders || false);
      setOrderColumns(selectedTrial.orderColumns || []);
      setStimuliOrders(selectedTrial.stimuliOrders || []);
      setCategories(selectedTrial.categories || false);
      setCategoryColumn(selectedTrial.categoryColumn || "");

      setTimeout(() => {
        setIsLoadingTrial(false);
        isInitialFileLoad.current = false; // Permitir guardado después de cargar el trial
      }, 100); // 500 en producción
    }

    // eslint-disable-next-line
  }, [selectedTrial]);

  // parámetros mapeados de los plugins
  const fieldGroups = {
    pluginParameters: parameters,
  };

  const { getColumnValue } = useCsvMapper({
    fieldGroups: fieldGroups,
  });
  // ^Por la implementación del webgazer esto se define así^

  const isTrialInLoop = !!selectedTrial?.csvFromLoop;

  const { genTrialCode } = useTrialCode({
    id: selectedTrial?.id,
    branches: selectedTrial?.branches,
    branchConditions: selectedTrial?.branchConditions,
    repeatConditions: selectedTrial?.repeatConditions,
    paramsOverride: selectedTrial?.paramsOverride,
    pluginName: pluginName,
    parameters: parameters,
    getColumnValue: getColumnValue,
    needsFileUpload: needsFileUpload,
    columnMapping: columnMapping,
    filteredFiles: filteredFiles,
    csvJson: csvJson,
    trialName: trialName,
    data: data,
    includesExtensions: includesExtensions,
    extensions: extensions,
    orders: orders,
    stimuliOrders: stimuliOrders,
    categories: categories,
    categoryData: categoryData,
    isInLoop: isTrialInLoop,
  });

  const canSave = !!trialName && !isLoadingTrial;
  // guardar y actualizar el estado global del ensayo
  const handleSave = () => {
    if (!canSave) return;

    // Helper recursivo para actualizar trial en cualquier nivel de anidamiento
    const updateTrialRecursive = (
      items: any[]
    ): { updated: any[]; found: boolean } => {
      let found = false;
      const updated = items.map((item: any) => {
        // Si es el trial que buscamos (tiene plugin O type y coincide el ID)
        if (
          ("plugin" in item || "type" in item) &&
          item.id == selectedTrial?.id
        ) {
          found = true;
          return {
            ...item,
            id: Number(item.id),
            name: trialName,
            plugin: pluginName,
            parameters: {
              includesExtensions: includesExtensions,
              extensionType: extensionType,
            },
            trialCode: genTrialCode(),
            columnMapping: { ...columnMapping },
            csvJson: [...csvJson],
            csvColumns: [...csvColumns],
            orders,
            orderColumns,
            stimuliOrders,
            categories,
            categoryColumn,
          };
        }

        // Si es un loop, buscar recursivamente en sus trials
        if ("trials" in item && Array.isArray(item.trials)) {
          const result = updateTrialRecursive(item.trials);
          if (result.found) {
            found = true;
            return {
              ...item,
              trials: result.updated,
            };
          }
        }

        return item;
      });

      return { updated, found };
    };

    // Obtener el trial original para comparar
    const findTrialRecursive = (items: any[]): any => {
      for (const item of items) {
        // Un trial puede tener "plugin" O "type" (para compatibilidad)
        if (
          ("plugin" in item || "type" in item) &&
          item.id == selectedTrial?.id
        ) {
          return item;
        }
        if ("trials" in item && Array.isArray(item.trials)) {
          const found = findTrialRecursive(item.trials);
          if (found) return found;
        }
      }
      return null;
    };

    const prevTrial = findTrialRecursive(trials);

    if (!prevTrial) return;

    const updatedTrial = {
      ...prevTrial,
      id: Number(prevTrial.id),
      name: trialName,
      plugin: pluginName,
      parameters: {
        includesExtensions: includesExtensions,
        extensionType: extensionType,
      },
      trialCode: genTrialCode(),
      columnMapping: { ...columnMapping },
      csvJson: [...csvJson],
      csvColumns: [...csvColumns],
      orders,
      orderColumns,
      stimuliOrders,
      categories,
      categoryColumn,
    };

    if (isEqual(updatedTrial, prevTrial)) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      const result = updateTrialRecursive(trials);

      if (result.found) {
        setTrials(result.updated);
        setSelectedTrial(updatedTrial);
      }

      // less intrusve indicator
      setSaveIndicator(true);
      setTimeout(() => {
        setSaveIndicator(false);
      }, 2000);
    }, 1000);
  };
  useEffect(() => {
    handleSave();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [
    pluginName,
    includesExtensions,
    extensionType,
    columnMapping,
    csvJson,
    csvColumns,
    orders,
    orderColumns,
    categories,
    categoryColumn,
    stimuliOrders,
    categoryData,
    trialName,
    isLoadingTrial,
  ]);

  const deleteCsv = () => {
    if (csvJson.length === 0) return;
    setCsvJson([]);
    setCsvColumns([]);
  };

  return (
    <div id="plugin-config">
      <div className="mb-1 input-section p-4 border rounded">
        <h4 className="text-lg font-bold mb-3"> {pluginName} </h4>

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
        {selectedTrial?.csvFromLoop ? (
          <div>
            <label>
              <input
                type="checkbox"
                checked={selectedTrial.csvFromLoop}
                disabled
                style={{ marginRight: 8 }}
              />
              Using CSV from loop
            </label>
          </div>
        ) : (
          <CsvUploader
            onCsvUpload={handleCsvUpload}
            csvJson={csvJson}
            onDeleteCSV={deleteCsv}
          />
        )}

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

        {/* Branched Trial moved to Canvas modal */}

        {/* Parameter section */}
        <ParameterMapper
          pluginName={pluginName}
          parameters={parameters}
          columnMapping={columnMapping}
          setColumnMapping={setColumnMapping}
          csvColumns={csvColumns}
        />

        <TrialOrders
          orders={orders}
          setOrders={setOrders}
          columnOptions={csvColumns}
          orderColumns={orderColumns}
          setOrderColumns={setOrderColumns}
          mapOrdersFromCsv={mapOrdersFromCsv}
          csvJson={csvJson}
          categories={categories}
          setCategories={setCategories}
          setCategoryColumn={setCategoryColumn}
          categoryColumn={categoryColumn}
          mapCategoriesFromCsv={mapCategoriesFromCsv}
        ></TrialOrders>

        {/* Extensions */}
        <ExtensionsConfig
          parameters={parameters}
          includesExtensions={includesExtensions}
          setIncludeExtensions={setIncludeExtensions}
          extensionType={extensionType}
          setExtensionType={setExtensionType}
        ></ExtensionsConfig>
      </div>

      <TrialActions
        onSave={handleSave}
        canSave={canSave}
        onDelete={handleDeleteTrial}
      />
    </div>
  );
}

export default TrialsConfig;
