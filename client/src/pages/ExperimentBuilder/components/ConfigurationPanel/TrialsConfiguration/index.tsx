import { useState, useEffect, useRef } from "react";
import useTrials from "../../../hooks/useTrials";
import { usePluginParameters } from "../hooks/usePluginParameters";
import Switch from "react-switch";
import TrialMetaConfig from "./TrialMetaConfig";
import ParameterMapper from "./ParameterMapper";
import TrialActions from "./TrialActions";
import { useFileUpload } from "../../Timeline/useFileUpload";
import { useCsvData } from "./Csv/useCsvData";
import { useColumnMapping } from "./hooks/useColumnMapping";
import { useExtensions } from "./Extensions/useExtensions";
import ExtensionsConfig from "./Extensions";
import { Trial, Loop } from "../types";
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

  const { csvColumns, setCsvColumns } = useCsvData();

  const { columnMapping, setColumnMapping } = useColumnMapping({});
  const { parameters } = usePluginParameters(pluginName);

  const {
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
    // CSV columns come from the parent loop only
    if (trial.parentLoopId) {
      const parentLoop = await getLoop(trial.parentLoopId);
      if (parentLoop) {
        return { csvColumns: parentLoop.csvColumns || [] };
      }
    }
    return { csvColumns: [] };
  }

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
        console.log(
          "🔍 [INDEX LOAD] columnMapping from DB:",
          selectedTrial.columnMapping,
        );
        console.log(
          "🔍 [INDEX LOAD] stimuli_duration:",
          selectedTrial.columnMapping?.stimuli_duration,
        );
        console.log(
          "🔍 [INDEX LOAD] trial_duration:",
          selectedTrial.columnMapping?.trial_duration,
        );
        console.log(
          "🔍 [INDEX LOAD] response_ends_trial:",
          selectedTrial.columnMapping?.response_ends_trial,
        );
        setColumnMapping(selectedTrial.columnMapping || {});

        // Priority to loop CSV columns if exists
        const { csvColumns: effectiveCsvColumns } =
          await getLoopCsvData(selectedTrial);

        setCsvColumns(effectiveCsvColumns);

        setTimeout(() => {
          setIsLoadingTrial(false);
          isInitialFileLoad.current = false; // Permitir guardado después de cargar el trial
        }, 100); // 500 en producción
      }
    };
    loadTrialData();

    // eslint-disable-next-line
  }, [selectedTrial]);

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

  // Note: trialCode is NO LONGER generated here - it's generated dynamically when needed
  // (Run Experiment, Run Demo, Publish) to avoid storing duplicate data

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

  // Guardar extensions (recibe valores como parámetros para evitar closures)
  const saveExtensions = async (includeExt: boolean, extType: string) => {
    if (!selectedTrial) return;
    await saveField("parameters", {
      includesExtensions: includeExt,
      extensionType: extType,
    });
  };

  // Guardar TODO (botón manual - 1 solo request con todos los campos)
  const handleSave = async () => {
    if (!canSave || !selectedTrial) return;

    console.log("🔍 [INDEX SAVE] columnMapping before save:", columnMapping);
    console.log(
      "🔍 [INDEX SAVE] stimuli_duration:",
      columnMapping.stimuli_duration,
    );
    console.log(
      "🔍 [INDEX SAVE] trial_duration:",
      columnMapping.trial_duration,
    );
    console.log(
      "🔍 [INDEX SAVE] response_ends_trial:",
      columnMapping.response_ends_trial,
    );

    const updatedTrialData = {
      name: trialName,
      plugin: pluginName,
      parameters: {
        includesExtensions,
        extensionType,
      },
      // trialCode is NO LONGER saved - it's generated dynamically when needed
      columnMapping: { ...columnMapping },
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
        {/* CSV info - CSV is managed at loop level only */}
        {parentLoop && (parentLoop.csvJson?.length ?? 0) > 0 && (
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
              checked={true}
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
