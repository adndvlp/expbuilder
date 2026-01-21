import { useState, useEffect, useRef } from "react";
import useTrials from "../../../hooks/useTrials";
import { usePluginParameters } from "../hooks/usePluginParameters";
import Switch from "react-switch";
import TrialMetaConfig from "./TrialMetaConfig";
import CsvUploader from "./Csv/CsvUploader";
import ParameterMapper from "./ParameterMapper";
import TrialActions from "./TrialActions";
import { useFileUpload } from "../../Timeline/useFileUpload";
import { useCsvData } from "./Csv/useCsvData";
import { useColumnMapping } from "./hooks/useColumnMapping";
import { useCsvMapper } from "./Csv/useCsvMapper";
import { useTrialCode } from "./TrialCode/useTrialCode";
import { useExtensions } from "./Extensions/useExtensions";
import ExtensionsConfig from "./Extensions";
import { Trial, Loop } from "../types";
import { useOrdersAndCategories } from "./OrdersAndCategories/useOrdersAndCategories";
import OrdersAndCategories from "./OrdersAndCategories";
import TabContent from "./TabContent";

type Props = { pluginName: string };

function TrialsConfig({ pluginName }: Props) {
  // Basic trial configuration
  const {
    selectedTrial,
    setSelectedTrial,
    updateTrial,
    updateTrialField,
    getLoop,
  } = useTrials();
  const [trialName, setTrialName] = useState<string>("");

  // Autosave
  const [isLoadingTrial, setIsLoadingTrial] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialFileLoad = useRef(false);
  const [saveIndicator, setSaveIndicator] = useState(false);
  const [savingField, setSavingField] = useState<string | null>(null);

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

  // Simplified delete trial handler
  const { deleteTrial } = useTrials();

  const handleDeleteTrial = async () => {
    if (!selectedTrial) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete "${selectedTrial.name}"?`,
    );
    if (!confirmed) return;

    const success = await deleteTrial(selectedTrial.id);
    if (success) {
      setSelectedTrial(null);
    }
  };

  async function getLoopCsvData(trial: Trial) {
    if (!trial?.csvFromLoop)
      return {
        csvJson: trial?.csvJson || [],
        csvColumns: trial?.csvColumns || [],
      };

    // Find parent loop containing the trial using parentLoopId
    if (trial.parentLoopId) {
      const parentLoop = await getLoop(trial.parentLoopId);

      if (parentLoop) {
        return {
          csvJson: parentLoop.csvJson || [],
          csvColumns: parentLoop.csvColumns || [],
        };
      }
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
    setCategoryData,
    mapCategoriesFromCsv,
  } = useOrdersAndCategories();

  // Persistir/traer datos del trial
  useEffect(() => {
    const loadTrialData = async () => {
      if (selectedTrial) {
        setIsLoadingTrial(true);
        setTrialName(selectedTrial.name || "");
        setIncludeExtensions(
          selectedTrial.parameters?.includesExtensions !== undefined
            ? !!selectedTrial.parameters.includesExtensions
            : includesExtensions,
        );
        setExtensionType(selectedTrial.parameters?.extensionType || "");

        // Restaura CSV y columnas si existen
        setColumnMapping(selectedTrial.columnMapping || {});

        // Priority to loop CSV if exists, otherwise trial CSV
        const { csvJson: effectiveCsvJson, csvColumns: effectiveCsvColumns } =
          await getLoopCsvData(selectedTrial);

        setCsvJson(effectiveCsvJson);
        setCsvColumns(effectiveCsvColumns);

        setOrders(selectedTrial.orders || false);
        setOrderColumns(selectedTrial.orderColumns || []);
        setStimuliOrders(selectedTrial.stimuliOrders || []);
        setCategories(selectedTrial.categories || false);
        setCategoryColumn(selectedTrial.categoryColumn || "");
        setCategoryData(selectedTrial.categoryData || []);

        setTimeout(() => {
          setIsLoadingTrial(false);
          isInitialFileLoad.current = false; // Permitir guardado después de cargar el trial
        }, 100); // 500 en producción
      }
    };
    loadTrialData();

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

  // Detect parent loop context automatically using parentLoopId
  const [parentLoop, setParentLoop] = useState<Loop | null>(null);

  useEffect(() => {
    const loadParentLoop = async () => {
      if (!selectedTrial?.parentLoopId) {
        setParentLoop(null);
        return;
      }

      const loop = await getLoop(selectedTrial.parentLoopId);
      setParentLoop(loop);
    };

    loadParentLoop();
  }, [selectedTrial?.parentLoopId]);

  // Detect if this is the dynamic plugin
  const isDynamicPlugin = pluginName === "plugin-dynamic";
  // Get uploaded files from Timeline
  const folder = "all";
  const { uploadedFiles } = useFileUpload({ folder });

  const { genTrialCode } = useTrialCode({
    id: selectedTrial?.id,
    branches: selectedTrial?.branches,
    branchConditions: selectedTrial?.branchConditions,
    repeatConditions: selectedTrial?.repeatConditions,
    paramsOverride: selectedTrial?.paramsOverride,
    pluginName: pluginName,
    parameters: parameters,
    getColumnValue: getColumnValue,
    columnMapping: columnMapping,
    uploadedFiles: uploadedFiles,
    csvJson: csvJson,
    trialName: trialName,
    data: data,
    includesExtensions: includesExtensions,
    extensions: extensions,
    // Use loop context if trial is inside a loop
    orders: parentLoop?.orders || orders,
    stimuliOrders: parentLoop?.stimuliOrders || stimuliOrders,
    categories: parentLoop?.categories || categories,
    categoryData: parentLoop?.categoryData || categoryData,
    isInLoop: !!parentLoop,
    parentLoopId: parentLoop?.id,
  });

  const canSave = !!trialName && !isLoadingTrial;

  // Función auxiliar para mostrar indicador de guardado
  const showSaveIndicator = (fieldName?: string) => {
    setSavingField(fieldName || null);
    setSaveIndicator(true);
    setTimeout(() => {
      setSaveIndicator(false);
      setSavingField(null);
    }, 1500);
  };

  // Guardar campo individual (para autoguardado granular)
  const saveField = async (fieldName: string, value: any) => {
    if (!selectedTrial) return;
    const success = await updateTrialField(selectedTrial.id, fieldName, value);
    if (success) {
      showSaveIndicator(fieldName);
    }
  };

  // Guardar nombre del trial
  const saveName = async () => {
    if (!selectedTrial || !trialName) return;
    await saveField("name", trialName);
  };

  // Guardar columnMapping (con parámetros para evitar closures)
  const saveColumnMapping = async (key: string, value: any) => {
    if (!selectedTrial) return;
    // Actualizar solo el campo específico del columnMapping
    const updatedMapping =
      value !== undefined
        ? { ...selectedTrial.columnMapping, [key]: value }
        : (() => {
            const { [key]: removed, ...rest } =
              selectedTrial.columnMapping || {};
            return rest;
          })();
    await saveField("columnMapping", updatedMapping);
  };

  // Guardar CSV data
  const saveCsvData = async (dataToSave?: any[], colsToSave?: string[]) => {
    if (!selectedTrial) return;

    const finalJson = dataToSave !== undefined ? dataToSave : csvJson;
    const finalCols = colsToSave !== undefined ? colsToSave : csvColumns;

    await updateTrialField(
      selectedTrial.id,
      "csvJson",
      finalJson ? [...finalJson] : [],
    );
    await updateTrialField(
      selectedTrial.id,
      "csvColumns",
      finalCols ? [...finalCols] : [],
    );
    showSaveIndicator("csv");
  };

  // Wrapper para handleCsvUpload que guarda automáticamente
  const onHandleCsvUploadWrapped = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleCsvUpload(e, (newData, newCols) => {
      saveCsvData(newData, newCols);
    });
  };

  // Guardar extensions (recibe valores como parámetros para evitar closures)
  const saveExtensions = async (includeExt: boolean, extType: string) => {
    if (!selectedTrial) return;
    await saveField("parameters", {
      includesExtensions: includeExt,
      extensionType: extType,
    });
  };

  // Guardar trial orders (1 solo request con todos los campos)
  const saveOrdersAndCategories = async (
    ord: boolean,
    ordCols: string[],
    stimOrd: any[],
    cat: boolean,
    catCol: string,
    catData: any[],
  ) => {
    if (!selectedTrial) return;

    // Usar updateTrial para 1 solo PATCH con todos los campos
    const updatedTrial = await updateTrial(selectedTrial.id, {
      orders: ord,
      orderColumns: ordCols,
      stimuliOrders: stimOrd,
      categories: cat,
      categoryColumn: catCol,
      categoryData: catData,
    });

    if (updatedTrial) {
      showSaveIndicator("orders");
    }
  };

  // Guardar trialCode (generado)
  const saveTrialCode = async () => {
    if (!selectedTrial) return;
    await saveField("trialCode", genTrialCode());
  };

  // Guardar TODO (botón manual - 1 solo request con todos los campos)
  const handleSave = async () => {
    if (!canSave || !selectedTrial) return;

    const updatedTrialData = {
      name: trialName,
      plugin: pluginName,
      parameters: {
        includesExtensions,
        extensionType,
      },
      trialCode: genTrialCode(),
      columnMapping: { ...columnMapping },
      csvJson: csvJson ? [...csvJson] : [],
      csvColumns: csvColumns ? [...csvColumns] : [],
      orders,
      orderColumns,
      stimuliOrders,
      categories,
      categoryColumn,
      categoryData,
      parentLoopId: parentLoop?.id || null,
    };

    try {
      const updatedTrial = await updateTrial(
        selectedTrial.id,
        updatedTrialData,
      );
      if (updatedTrial) {
        setSelectedTrial(updatedTrial);
      }
      showSaveIndicator();
    } catch (error) {
      console.error("Error saving trial:", error);
    }
  };

  // Auto-save removed - using manual save only
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const deleteCsv = () => {
    if (csvJson.length === 0) return;
    setCsvJson([]);
    setCsvColumns([]);
    saveCsvData([], []);
  };

  return (
    <div id="plugin-config">
      <div className="mb-1 input-section p-4 border rounded">
        {!isDynamicPlugin && (
          <h4 className="text-lg font-bold mb-3"> {pluginName} </h4>
        )}
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
          ✓ Saved {savingField ? `(${savingField})` : "Trial"}
        </div>
        {/* Trial name */}
        <TrialMetaConfig
          trialName={trialName}
          setTrialName={setTrialName}
          selectedTrial={selectedTrial}
          setSelectedTrial={setSelectedTrial}
          onSave={saveName}
        />
        {/* CSV and XLSX section */}
        {selectedTrial?.csvFromLoop ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "16px",
              padding: "12px 16px",
              backgroundColor: "var(--neutral-light)",
              borderRadius: "8px",
              border: "1px solid var(--neutral-mid)",
            }}
          >
            <Switch
              checked={selectedTrial.csvFromLoop}
              onChange={() => {}}
              disabled={true}
              onColor="#f1c40f"
              offColor="#cccccc"
              onHandleColor="#ffffff"
              offHandleColor="#ffffff"
              handleDiameter={24}
              uncheckedIcon={false}
              checkedIcon={false}
              height={20}
              width={44}
            />
            <label
              style={{ margin: 0, fontWeight: 500, color: "var(--text-dark)" }}
            >
              Using CSV from loop
            </label>
          </div>
        ) : (
          <CsvUploader
            onCsvUpload={onHandleCsvUploadWrapped}
            csvJson={csvJson}
            onDeleteCSV={deleteCsv}
          />
        )}
        {/* Branched Trial moved to Canvas modal */}
        {/* Parameter section */}
        {isDynamicPlugin ? (
          <div className="mb-4">
            <TabContent
              pluginName={pluginName}
              parameters={parameters}
              columnMapping={columnMapping}
              csvColumns={csvColumns}
              uploadedFiles={uploadedFiles}
              saveIndicator={saveIndicator}
              saveField={saveField}
              savingField={savingField}
              saveColumnMapping={saveColumnMapping}
              setColumnMapping={setColumnMapping}
            />
          </div>
        ) : (
          <ParameterMapper
            pluginName={pluginName}
            parameters={parameters}
            columnMapping={columnMapping}
            setColumnMapping={setColumnMapping}
            csvColumns={csvColumns}
            uploadedFiles={uploadedFiles}
            onSave={saveColumnMapping}
          />
        )}{" "}
        <OrdersAndCategories
          orders={orders}
          setOrders={setOrders}
          columnOptions={csvColumns}
          orderColumns={orderColumns}
          setOrderColumns={setOrderColumns}
          mapOrdersFromCsv={mapOrdersFromCsv}
          csvJson={csvJson}
          stimuliOrders={stimuliOrders}
          categories={categories}
          setCategories={setCategories}
          setCategoryColumn={setCategoryColumn}
          categoryColumn={categoryColumn}
          categoryData={categoryData}
          mapCategoriesFromCsv={mapCategoriesFromCsv}
          onSave={saveOrdersAndCategories}
        ></OrdersAndCategories>
        {/* Extensions */}
        <ExtensionsConfig
          parameters={parameters}
          includesExtensions={includesExtensions}
          setIncludeExtensions={setIncludeExtensions}
          extensionType={extensionType}
          setExtensionType={setExtensionType}
          pluginName={pluginName}
          columnMapping={columnMapping}
          onSave={saveExtensions}
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
