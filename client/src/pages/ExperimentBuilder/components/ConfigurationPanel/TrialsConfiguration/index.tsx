import { useState, useEffect, useRef } from "react";
import useTrials from "../../../hooks/useTrials";
import { usePluginParameters } from "../hooks/usePluginParameters";
import TrialMetaConfig from "./TrialMetaConfig";
import ParameterMapper from "./ParameterMapper";
import TrialActions from "./TrialActions";
import { useFileUpload } from "../../Timeline/useFileUpload";
import { useCsvData } from "./Csv/useCsvData";
import { useColumnMapping } from "./hooks/useColumnMapping";
import { useExtensions } from "./Extensions/useExtensions";
import ExtensionsConfig from "./Extensions";
import TabContent from "./TabContent";
import LoopCsvIndicator from "./components/LoopCsvIndicator";
import SaveIndicator from "./components/SaveIndicator";
import TrialLifecycleCode from "./components/TrialLifecycleCode";
import { useParentLoop } from "./hooks/useParentLoop";
import { getLoopCsvData } from "./services/getLoopCsvData";

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
        const { csvColumns: effectiveCsvColumns } = await getLoopCsvData(
          selectedTrial,
          getLoop,
        );

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

  const parentLoop = useParentLoop(selectedTrial, getLoop);

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
            const rest = { ...(selectedTrial.columnMapping || {}) };
            delete rest[key];
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

  return (
    <div id="plugin-config">
      <div className="mb-1 input-section p-4 border rounded">
        {!isDynamicPlugin && (
          <h4 className="text-lg font-bold mb-3"> {pluginName} </h4>
        )}
        {/* Indicador de guardado */}
        <SaveIndicator field={savingField} visible={saveIndicator} />
        {/* Trial name */}
        <TrialMetaConfig
          trialName={trialName}
          setTrialName={setTrialName}
          selectedTrial={selectedTrial}
          setSelectedTrial={setSelectedTrial}
          onSave={trialName ? saveName : undefined}
        />
        {/* CSV info - CSV is managed at loop level only */}
        <LoopCsvIndicator parentLoop={parentLoop} />
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
        {/* Custom Code Injection */}
        <TrialLifecycleCode
          trial={selectedTrial}
          onSave={(field, value) => saveField(field, value)}
        />
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
