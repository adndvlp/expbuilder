import { useState } from "react";
import { useCsvData } from "../Csv/useCsvData";
import useTrials from "../../../../hooks/useTrials";
import TrialMetaConfig from "../TrialMetaConfig";
import ParameterMapper from "../ParameterMapper";
import TrialActions from "../TrialActions";
import InstructionsConfig from "./Instructions";
import { useColumnMapping } from "../hooks/useColumnMapping";
import InstructionsArrays from "./InstructionsArrays";
import SaveIndicator from "../components/SaveIndicator";
import { useWebgazerPhases } from "./hooks/useWebgazerPhases";

type Props = { webgazerPlugins: string[] };

function Webgazer({ webgazerPlugins }: Props) {
  // Basic trial configuration
  // these are the replacement of pluginName
  const {
    initCameraInstructions,
    calibrateInstructions,
    validateInstructions,
    recalibrateInstructions,
  } = InstructionsArrays();

  // Autosave
  const [isLoadingTrial, setIsLoadingTrial] = useState(false);
  const [saveIndicator, setSaveIndicator] = useState(false);
  const [savingField, setSavingField] = useState<string | null>(null);

  const { csvJson, setCsvJson, csvColumns, setCsvColumns } = useCsvData();

  const {
    updateTrial,
    updateTrialField,
    selectedTrial,
    setSelectedTrial,
    deleteTrial,
  } = useTrials();

  const [trialName, setTrialName] = useState<string>("");
  const { columnMapping, setColumnMapping } = useColumnMapping({});

  const {
    includeInstructions: include_instructions,
    mappedColumns,
    minimumPercentAcceptable,
    phases: webGazerPhases,
    recalibratePhase,
    recalibratePlugin: recalibrateWebGazer,
    trialCode,
  } = useWebgazerPhases({
    columnMapping,
    csvJson,
    instructions: [
      initCameraInstructions,
      calibrateInstructions,
      validateInstructions,
      recalibrateInstructions,
    ],
    plugins: webgazerPlugins,
    selectedTrial,
    setColumnMapping,
    setCsvColumns,
    setCsvJson,
    setIsLoadingTrial,
    setTrialName,
  });

  // Note: trialCode is saved to DB on every change
  // generateTrialLoopCodes will use the saved code instead of regenerating it

  // guardar y actualizar el estado global del ensayo

  const canSave = !!trialName && !isLoadingTrial && !!selectedTrial;

  // Función auxiliar para mostrar indicador de guardado
  const showSaveIndicator = (fieldName?: string) => {
    setSavingField(fieldName || null);
    setSaveIndicator(true);
    setTimeout(() => {
      setSaveIndicator(false);
      setSavingField(null);
    }, 1500);
  };

  // Guardar campo individual
  const saveField = async (fieldName: string, value: unknown) => {
    const success = await updateTrialField(selectedTrial!.id, fieldName, value);
    if (success) {
      showSaveIndicator(fieldName);
    }
  };

  // Guardar el código generado (se llama después de cada cambio)
  const saveTrialCode = async () => {
    if (!selectedTrial || !trialCode) return;
    await updateTrialField(selectedTrial.id, "trialCode", trialCode);
  };

  // Guardar nombre
  const saveName = async () => {
    if (!selectedTrial || !trialName) return;
    await saveField("name", trialName);
    await saveTrialCode();
  };

  // Guardar Column Mapping (compartido por todas las fases)
  const saveColumnMapping = async (key: string, value: unknown) => {
    if (!selectedTrial) return;
    const updatedMapping =
      value !== undefined
        ? { ...columnMapping, [key]: value }
        : (() => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { [key]: _, ...rest } = columnMapping || {};
            return rest;
          })();

    await saveField("columnMapping", updatedMapping);
    await saveTrialCode();
  };

  // Guardar Instructions (complejo porque depende de múltiples fases)
  const saveInstructions = async (changedPlugin: string, newValue: boolean) => {
    if (!selectedTrial) return;
    const currentParams = selectedTrial.parameters || {};
    const currentInstructions =
      currentParams.include_instructions || include_instructions;
    const updatedInstructions = {
      ...currentInstructions,
      [changedPlugin]: newValue,
    };
    await saveField("parameters", {
      ...currentParams,
      include_instructions: updatedInstructions,
      minimum_percent:
        currentParams.minimum_percent ?? minimumPercentAcceptable,
    });
    await saveTrialCode();
  };

  // Guardar Minimum Percent
  const saveMinimumPercent = async (newValue: number) => {
    if (!selectedTrial) return;
    const currentParams = selectedTrial.parameters || {};
    await saveField("parameters", {
      ...currentParams,
      minimum_percent: newValue,
    });
    await saveTrialCode();
  };

  const handleSave = async () => {
    if (!canSave || !selectedTrial) return;

    const updatedData = {
      name: trialName,
      plugin: "webgazer",
      parameters: {
        include_instructions: include_instructions,
        minimum_percent: minimumPercentAcceptable,
      },
      // WebGazer is complex, so we save the generated code
      trialCode: trialCode,
      columnMapping: mappedColumns,
    };

    try {
      const updated = await updateTrial(selectedTrial.id, updatedData);
      if (updated) {
        setSelectedTrial(updated);
      }
      showSaveIndicator();
    } catch (error) {
      console.error("Error saving trial:", error);
    }
  };

  // Delete trial handler
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

  return (
    <div id="plugin-config">
      <SaveIndicator field={savingField} visible={saveIndicator} />
      <div className="mb-1 input-section p-4 border rounded">
        <h4 className="text-lg font-bold mb-3">WebGazer</h4>

        {/* Trial name */}
        <TrialMetaConfig
          trialName={trialName}
          setTrialName={setTrialName}
          selectedTrial={selectedTrial}
          setSelectedTrial={setSelectedTrial}
          onSave={saveName}
        />

        {webGazerPhases.map((phase) => (
          <div key={phase.id} className="input-section p-4 border rounded">
            <h4 className="text-lg font-bold mb-3"> {phase.pluginName} </h4>

            <InstructionsConfig
              includeInstructions={phase.includeInstructions}
              setIncludeInstructions={(val) => {
                phase.setIncludeInstructions(val);
                saveInstructions(phase.pluginName, val);
              }}
              instructionsFields={phase.fieldGroups.instructions}
              columnMapping={phase.columnMapping}
              setColumnMapping={phase.setColumnMapping}
              csvColumns={csvColumns}
              onSave={saveColumnMapping}
            />

            {phase.pluginName !== recalibrateWebGazer && (
              <>
                {/* Parameter section */}
                <ParameterMapper
                  pluginName={phase.pluginName}
                  parameters={phase.fieldGroups.parameters}
                  columnMapping={phase.columnMapping}
                  setColumnMapping={phase.setColumnMapping}
                  csvColumns={csvColumns}
                  onSave={saveColumnMapping}
                />
              </>
            )}
            {phase.pluginName === recalibrateWebGazer && (
              <div className=" input-section p-4 border rounded">
                <h6 className="text-lg font-bold mb-3">
                  {" "}
                  Minimum percent acceptable to recalibrate{" "}
                </h6>
                <input
                  max={100}
                  min={1}
                  type="number"
                  value={minimumPercentAcceptable}
                  placeholder="1-100"
                  onChange={(e) => {
                    const val = Math.max(
                      1,
                      Math.floor(Number(e.target.value)) || 1,
                    );
                    const setPercent =
                      recalibratePhase.setMinimumPercentAcceptable;
                    setPercent(val);
                  }}
                  onBlur={(e) => {
                    const val = Math.max(
                      1,
                      Math.floor(Number(e.target.value)) || 1,
                    );
                    saveMinimumPercent(val);
                  }}
                ></input>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Save button */}
      <TrialActions
        onSave={handleSave}
        canSave={canSave}
        onDelete={handleDeleteTrial}
      />
    </div>
  );
}

export default Webgazer;
