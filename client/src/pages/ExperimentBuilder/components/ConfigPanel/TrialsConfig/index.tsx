import { useState, useEffect, useRef, useMemo } from "react";
import useTrials from "../../../hooks/useTrials";
import { usePluginParameters } from "../hooks/usePluginParameters";
import Switch from "react-switch";
import TrialMetaConfig from "./TrialMetaConfig";
import CsvUploader from "./CsvUploader";
import ParameterMapper from "./ParameterMapper";
import TrialActions from "./TrialActions";
import { useFileUpload } from "../../Timeline/useFileUpload";
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
import KonvaTrialDesigner from "./ParameterMapper/KonvaTrialDesigner";
import { MdEdit } from "react-icons/md";

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

  // Memoize filtered parameters to avoid infinite re-renders
  const filteredDynamicPluginParameters = useMemo(
    () =>
      parameters.filter(
        (p) => !["components", "response_components"].includes(p.key)
      ),
    [parameters]
  );

  const {
    extensions,
    includesExtensions,
    setIncludeExtensions,
    extensionType,
    setExtensionType,
  } = useExtensions(pluginName, parameters);

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

  // Detect if this is the dynamic plugin
  const isDynamicPlugin = pluginName === "plugin-dynamic";
  const [showKonvaDesigner, setShowKonvaDesigner] = useState(false);
  const [dynamicPluginTab, setDynamicPluginTab] = useState<
    "components" | "general"
  >("components");
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
    orders: orders,
    stimuliOrders: stimuliOrders,
    categories: categories,
    categoryData: categoryData,
    isInLoop: isTrialInLoop,
  });

  const canSave = !!trialName && !isLoadingTrial;
  // guardar y actualizar el estado global del ensayo
  const handleSave = (force = false) => {
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

    if (!force && isEqual(updatedTrial, prevTrial)) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      const result = updateTrialRecursive(trials);

      if (result.found) {
        setTrials(result.updated);
        setSelectedTrial(updatedTrial);
        // console.log(updatedTrial);
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
            onCsvUpload={handleCsvUpload}
            csvJson={csvJson}
            onDeleteCSV={deleteCsv}
          />
        )}
        {/* Branched Trial moved to Canvas modal */}
        {/* Parameter section */}
        {isDynamicPlugin ? (
          <div className="mb-4">
            {/* Tab Navigation */}
            <div
              style={{
                display: "flex",
                gap: "6px",
                marginBottom: "20px",
                padding: "4px",
                backgroundColor: "var(--neutral-light)",
                borderRadius: "12px",
                border: "1px solid var(--neutral-mid)",
              }}
            >
              <button
                type="button"
                onClick={() => setDynamicPluginTab("components")}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  background:
                    dynamicPluginTab === "components"
                      ? "linear-gradient(135deg, var(--primary-blue), #2c7a96)"
                      : "transparent",
                  color:
                    dynamicPluginTab === "components"
                      ? "white"
                      : "var(--text-dark)",
                  boxShadow:
                    dynamicPluginTab === "components"
                      ? "0 4px 12px rgba(61, 146, 180, 0.3)"
                      : "none",
                  transform:
                    dynamicPluginTab === "components" ? "scale(1.02)" : "none",
                }}
                onMouseOver={(e) => {
                  if (dynamicPluginTab !== "components") {
                    e.currentTarget.style.backgroundColor =
                      "rgba(61, 146, 180, 0.1)";
                  }
                }}
                onMouseOut={(e) => {
                  if (dynamicPluginTab !== "components") {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
              >
                Components
              </button>
              <button
                type="button"
                onClick={() => setDynamicPluginTab("general")}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  background:
                    dynamicPluginTab === "general"
                      ? "linear-gradient(135deg, var(--primary-blue), #2c7a96)"
                      : "transparent",
                  color:
                    dynamicPluginTab === "general"
                      ? "white"
                      : "var(--text-dark)",
                  boxShadow:
                    dynamicPluginTab === "general"
                      ? "0 4px 12px rgba(61, 146, 180, 0.3)"
                      : "none",
                  transform:
                    dynamicPluginTab === "general" ? "scale(1.02)" : "none",
                }}
                onMouseOver={(e) => {
                  if (dynamicPluginTab !== "general") {
                    e.currentTarget.style.backgroundColor =
                      "rgba(61, 146, 180, 0.1)";
                  }
                }}
                onMouseOut={(e) => {
                  if (dynamicPluginTab !== "general") {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
              >
                General Settings
              </button>
            </div>

            {/* Tab Content */}
            {dynamicPluginTab === "components" ? (
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "center",
                  margin: "24px 0",
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowKonvaDesigner(true)}
                  style={{
                    padding: "12px 24px",
                    border: "none",
                    borderRadius: "10px",
                    background:
                      "linear-gradient(135deg, var(--gold), var(--dark-gold))",
                    color: "white",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    boxShadow: "0 4px 12px rgba(212, 175, 55, 0.3)",
                    position: "relative",
                    overflow: "hidden",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow =
                      "0 6px 16px rgba(212, 175, 55, 0.4)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow =
                      "0 4px 12px rgba(212, 175, 55, 0.3)";
                  }}
                >
                  <MdEdit style={{ fontSize: "18px" }} />
                  Open Visual Designer
                </button>

                <KonvaTrialDesigner
                  isOpen={showKonvaDesigner}
                  onClose={() => setShowKonvaDesigner(false)}
                  onSave={(config) => {
                    // Replace columnMapping with the complete config from Konva designer
                    // This includes both components and General Settings parameters
                    setColumnMapping(config);
                    setShowKonvaDesigner(false);
                  }}
                  parameters={parameters}
                  columnMapping={columnMapping}
                  csvColumns={csvColumns}
                  pluginName={pluginName}
                />
              </div>
            ) : (
              <ParameterMapper
                pluginName={pluginName}
                parameters={filteredDynamicPluginParameters}
                columnMapping={columnMapping}
                setColumnMapping={setColumnMapping}
                csvColumns={csvColumns}
              />
            )}
          </div>
        ) : (
          <ParameterMapper
            pluginName={pluginName}
            parameters={parameters}
            columnMapping={columnMapping}
            setColumnMapping={setColumnMapping}
            csvColumns={csvColumns}
          />
        )}{" "}
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
        onSave={() => handleSave(true)}
        canSave={canSave}
        onDelete={handleDeleteTrial}
      />
    </div>
  );
}

export default TrialsConfig;
