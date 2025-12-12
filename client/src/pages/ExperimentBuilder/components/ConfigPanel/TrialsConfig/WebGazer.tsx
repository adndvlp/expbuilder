import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useCsvData } from "./hooks/useCsvData";
import useTrials from "../../../hooks/useTrials";
import { useTrialPersistence } from "./hooks/useTrialPersistence";
import TrialMetaConfig from "./TrialMetaConfig";
import CsvUploader from "./CsvUploader";
import ParameterMapper from "./ParameterMapper";
import TrialActions from "./TrialActions";
import InstructionsConfig from "./InstructionsConfig";
import { usePhase } from "./hooks/usePhase";
import { useColumnMapping } from "./hooks/useColumnMapping";
import isEqual from "lodash.isequal";

type Props = { webgazerPlugins: string[] };

function WebGazer({ webgazerPlugins }: Props) {
  // Basic trial configuration
  // these are the replacement of pluginName
  const initCamera = webgazerPlugins[1];
  const calibrateWebgazer = webgazerPlugins[0];
  const validateWebgazer = webgazerPlugins[3];
  const recalibrateWebGazer = webgazerPlugins[2];

  const initCameraInstructions = [
    {
      label: "Init Camera Instructions",
      key: "plugin_webgazer_init_camera_instructions",
      type: "string",
      default: `
          <p>In order to participate you must allow the experiment to use your camera.</p>
          <p>You will be prompted to do this on the next screen.</p>
          <p>If you do not wish to allow use of your camera, you cannot participate in this experiment.<p>
          <p>It may take up to 30 seconds for the camera to initialize after you give permission.</p>
        `,
    },
    {
      label: "Button Choices",
      key: "plugin_webgazer_init_camera_choices",
      type: "string_array",
      default: ["Got it"],
    },
  ];

  const calibrateInstructions = [
    {
      label: "Calibrate Instructions",
      key: "plugin_webgazer_calibrate_instructions",
      type: "string",
      default: `
          <p>Now you'll calibrate the eye tracking, so that the software can use the image of your eyes to predict where you are looking.</p>
          <p>You'll see a series of dots appear on the screen. Look at each dot and click on it.</p>
        `,
    },
    {
      label: "Button Choices",
      key: "plugin_webgazer_calibrate_choices",
      type: "string_array",
      default: ["Got it"],
    },
  ];

  const validateInstructions = [
    {
      label: "Validate Instructions",
      key: "plugin_webgazer_validate_instructions",
      type: "string",
      default: `
          <p>Now we'll measure the accuracy of the calibration.</p>
          <p>Look at each dot as it appears on the screen.</p>
          <p style="font-weight: bold;">You do not need to click on the dots this time.</p>
        `,
    },
    {
      label: "Button Choices",
      key: "plugin_webgazer_validate_choices",
      type: "string_array",
      default: ["Got it"],
    },
    {
      label: "Post Trial Gap",
      key: "post_trial_gap",
      type: "number",
      default: 1000,
    },
  ];

  const recalibrateInstructions = [
    {
      label: "Recalibrate Instructions",
      key: "plugin_webgazer_recalibrate_instructions",
      type: "string",
      default: `
          <p>The accuracy of the calibration is a little lower than we'd like.</p>
          <p>Let's try calibrating one more time.</p>
          <p>On the next screen, look at the dots and click on them.<p>
        `,
    },
    {
      label: "Button Choices",
      key: "plugin_webgazer_recalibrate_choices",
      type: "string_array",
      default: ["OK"],
    },
  ];

  // Autosave
  const [isLoadingTrial, setIsLoadingTrial] = useState(false);
  const [saveIndicator, setSaveIndicator] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialFileLoad = useRef(false);

  const { csvJson, setCsvJson, csvColumns, setCsvColumns, handleCsvUpload } =
    useCsvData();

  const { trials, setTrials, selectedTrial, setSelectedTrial } = useTrials();

  const [trialName, setTrialName] = useState<string>("");
  const { columnMapping, setColumnMapping } = useColumnMapping({});

  const initCameraPhase = usePhase({
    pluginName: initCamera,
    instructions: initCameraInstructions,
    csvJson,
    selectedTrial,
    setTrialName,
    setCsvJson,
    setCsvColumns,
    columnMapping,
    setColumnMapping,
    setIsLoadingTrial,
  });
  const calibratePhase = usePhase({
    pluginName: calibrateWebgazer,
    instructions: calibrateInstructions,
    csvJson,
    selectedTrial,
    setTrialName,
    setCsvJson,
    setCsvColumns,
    columnMapping, // checar copias de los mapeos anidados en todas las fases
    setColumnMapping,
    setIsLoadingTrial,
  });
  const validatePhase = usePhase({
    pluginName: validateWebgazer,
    instructions: validateInstructions,
    csvJson,
    selectedTrial,
    setTrialName,
    setCsvJson,
    setCsvColumns,
    columnMapping,
    setColumnMapping,
    setIsLoadingTrial,
  });
  const recalibratePhase = usePhase({
    pluginName: recalibrateWebGazer,
    instructions: recalibrateInstructions,
    csvJson,
    selectedTrial,
    setTrialName,
    setCsvJson,
    setCsvColumns,
    columnMapping,
    setColumnMapping,
    setIsLoadingTrial,
  });

  const { handleDeleteTrial } = useTrialPersistence({
    trials,
    setTrials,
    selectedTrial,
    setSelectedTrial,
  });

  const webGazerPhases = [
    {
      id: "initializeCamera",
      pluginName: initCamera,
      data: initCameraPhase.data,
      columnMapping: initCameraPhase.columnMapping,
      setColumnMapping: initCameraPhase.setColumnMapping,
      includeInstructions: initCameraPhase.includeInstructions,
      setIncludeInstructions: initCameraPhase.setIncludeInstructions,
      fieldGroups: initCameraPhase.fieldGroups,
      trialCode: initCameraPhase.trialCode,
    },
    {
      id: "Calibrate",
      pluginName: calibrateWebgazer,
      data: calibratePhase.data,
      columnMapping: calibratePhase.columnMapping,
      setColumnMapping: calibratePhase.setColumnMapping,
      includeInstructions: calibratePhase.includeInstructions,
      setIncludeInstructions: calibratePhase.setIncludeInstructions,
      fieldGroups: calibratePhase.fieldGroups,
      trialCode: calibratePhase.trialCode,
    },
    {
      id: "Validate",
      pluginName: validateWebgazer,
      data: validatePhase.data,
      columnMapping: validatePhase.columnMapping,
      setColumnMapping: validatePhase.setColumnMapping,
      includeInstructions: validatePhase.includeInstructions,
      setIncludeInstructions: validatePhase.setIncludeInstructions,
      fieldGroups: validatePhase.fieldGroups,
      trialCode: validatePhase.trialCode,
    },
    {
      id: "Recalibrate",
      pluginName: recalibrateWebGazer,
      columnMapping: recalibratePhase.columnMapping, // no existe
      setColumnMapping: recalibratePhase.setColumnMapping, // no existe
      includeInstructions: recalibratePhase.includeInstructions,
      setIncludeInstructions: recalibratePhase.setIncludeInstructions,
      fieldGroups: recalibratePhase.fieldGroups,
      trialCode: recalibratePhase.trialCode,
    },
  ];

  const minimumPercentAcceptable = recalibratePhase.minimumPercentAcceptable;

  type InstructionsConfig = {
    [pluginName: string]: boolean;
  };

  const include_instructions: InstructionsConfig = useMemo(() => {
    return {
      [initCamera]: initCameraPhase.includeInstructions,
      [calibrateWebgazer]: calibratePhase.includeInstructions,
      [validateWebgazer]: validatePhase.includeInstructions,
      [recalibrateWebGazer]: recalibratePhase.includeInstructions,
    };
  }, [
    initCameraPhase.includeInstructions,
    calibratePhase.includeInstructions,
    validatePhase.includeInstructions,
    recalibratePhase.includeInstructions,
    initCamera,
    calibrateWebgazer,
    validateWebgazer,
    recalibrateWebGazer,
  ]);

  const mappedColumns = useMemo(() => {
    return {
      ...initCameraPhase.columnMapping,
      ...calibratePhase.columnMapping,
      ...validatePhase.columnMapping,
      ...recalibratePhase.columnMapping,
    };
  }, [
    initCameraPhase.columnMapping,
    calibratePhase.columnMapping,
    validatePhase.columnMapping,
    recalibratePhase.columnMapping,
  ]);

  const trialCode = useMemo(() => {
    return (
      initCameraPhase.trialCode +
      calibratePhase.trialCode +
      validatePhase.trialCode +
      recalibratePhase.trialCode
    );
  }, [
    initCameraPhase.trialCode,
    calibratePhase.trialCode,
    validatePhase.trialCode,
    recalibratePhase.trialCode,
  ]);

  // guardar y actualizar el estado global del ensayo

  const canSave = !!trialName && !isLoadingTrial;
  const handleSave = useCallback(
    (force = false) => {
      if (!canSave) return;

      if (isInitialFileLoad.current) {
        isInitialFileLoad.current = false;
        return;
      }

      const trialIndex = trials.findIndex((t) => t.name === trialName);
      if (trialIndex === -1) return;

      const prevTrial = trials[trialIndex];

      if (!("type" in prevTrial)) return;

      const updatedTrial = {
        ...prevTrial,
        plugin: "webgazer",
        parameters: {
          include_instructions: include_instructions,
          minimum_percent: minimumPercentAcceptable,
        },
        trialCode: trialCode,
        columnMapping: mappedColumns,
        csvJson: [...csvJson],
        csvColumns: [...csvColumns],
      };

      if (!force && isEqual(updatedTrial, prevTrial)) return;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      timeoutRef.current = setTimeout(() => {
        const updatedTrials = [...trials];
        updatedTrials[trialIndex] = updatedTrial;
        setTrials(updatedTrials);
        setSelectedTrial(updatedTrial);

        setSaveIndicator(true);
        setTimeout(() => {
          setSaveIndicator(false);
        }, 2000);
      }, 1000);
    },
    [
      canSave,
      trialName,
      include_instructions,
      minimumPercentAcceptable,
      trialCode,
      mappedColumns,
      csvJson,
      csvColumns,
      trials,
      setTrials,
      setSelectedTrial,
    ]
  );

  useEffect(() => {
    handleSave();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [handleSave]);

  const deleteCsv = () => {
    if (csvJson.length === 0) return;
    setCsvJson([]);
    setCsvColumns([]);
  };

  return (
    <div id="plugin-config">
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
        <h4 className="text-lg font-bold mb-3">WebGazer</h4>

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
        {webGazerPhases.map((phase) => (
          <div key={phase.id} className="input-section p-4 border rounded">
            <h4 className="text-lg font-bold mb-3"> {phase.pluginName} </h4>

            <InstructionsConfig
              includeInstructions={phase.includeInstructions}
              setIncludeInstructions={phase.setIncludeInstructions}
              instructionsFields={phase.fieldGroups.instructions}
              columnMapping={phase.columnMapping}
              setColumnMapping={phase.setColumnMapping}
              csvColumns={csvColumns}
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
                      Math.floor(Number(e.target.value)) || 1
                    );
                    const setPercent =
                      recalibratePhase.setMinimumPercentAcceptable;
                    setPercent(val);
                  }}
                ></input>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Save button */}
      <TrialActions
        onSave={() => handleSave(true)}
        canSave={canSave}
        onDelete={handleDeleteTrial}
      />
    </div>
  );
}

export default WebGazer;
