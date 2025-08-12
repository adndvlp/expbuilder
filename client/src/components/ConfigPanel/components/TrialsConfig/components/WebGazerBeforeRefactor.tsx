import { useEffect, useState } from "react";
import { useCsvData } from "../hooks/useCsvData";
import { usePluginParameters } from "../../../hooks/usePluginParameters";
import { useColumnMapping } from "../hooks/useColumnMapping";
import useTrials from "../../../../../hooks/useTrials";
import { useTrialPersistence } from "../hooks/useTrialPersistence";
import { useCsvMapper } from "../hooks/useCsvMapper";
import TrialMetaConfig from "./TrialMetaConfig";
import CsvUploader from "./CsvUploader";
import ParameterMapper from "./ParameterMapper";
import TrialActions from "./TrialActions";
import InstructionsConfig from "./InstructionsConfig";

type Props = { webgazerPlugins: string[] };

function WebGazer({ webgazerPlugins }: Props) {
  // Basic trial configuration

  // these are the replacement of pluginName
  const initCamera = webgazerPlugins[1];
  const calibrateWebgazer = webgazerPlugins[0];
  const validateWebgazer = webgazerPlugins[2];

  // --- Estado para el plugin de INICIALIZACIÓN DE CÁMARA ---
  const { parameters: initCameraParams, data: initCameraData } =
    usePluginParameters(initCamera);
  const {
    columnMapping: initCameraMapping,
    setColumnMapping: setInitCameraMapping,
  } = useColumnMapping({});

  // --- Estado para el plugin de CALIBRACIÓN ---
  const { parameters: calibrateParams, data: calibrateData } =
    usePluginParameters(calibrateWebgazer);
  const {
    columnMapping: calibrateMapping,
    setColumnMapping: setCalibrateMapping,
  } = useColumnMapping({});

  // --- Estado para el plugin de VALIDACIÓN ---
  const { parameters: validateParams } = usePluginParameters(validateWebgazer);
  const {
    columnMapping: validateMapping,
    setColumnMapping: setValidateMapping,
  } = useColumnMapping({});

  // --- Estado para Recalibración ---
  const {
    columnMapping: recalibrateMapping,
    setColumnMapping: setRecalibrateMapping,
  } = useColumnMapping({});

  const { trials, setTrials, selectedTrial, setSelectedTrial } = useTrials();
  const [trialName, setTrialName] = useState<string>("");

  const [includeInitCameraInstructions, setIncludeInitCameraInstructions] =
    useState<boolean>(false);
  const [includeCalibrateInstructions, setIncludeCalibrateInstructions] =
    useState<boolean>(false);
  const [includeValidateInstructions, setIncludeValidateInstructions] =
    useState<boolean>(false);
  const [includeRecalibrateInstructions, setIncludeRecalibrateInstructions] =
    useState<boolean>(false);

  const { csvJson, setCsvJson, csvColumns, setCsvColumns, handleCsvUpload } =
    useCsvData();

  // const { parameters, data } = usePluginParameters(pluginName);

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

      const include = selectedTrial.parameters?.include_instructions ?? {};

      setIncludeInitCameraInstructions(!!include.includeInitCameraInstructions);
      setIncludeCalibrateInstructions(!!include.includeCalibrateInstructions);
      setIncludeValidateInstructions(!!include.includeValidateInstructions);
      setIncludeRecalibrateInstructions(
        !!include.includeRecalibrateInstructions
      );

      // Restaura CSV y columnas si existen
      setInitCameraMapping(
        selectedTrial.columnMapping?.initCameraMapping || {}
      );
      setCalibrateMapping(selectedTrial.columnMapping?.calibrateMapping || {});
      setValidateMapping(selectedTrial.columnMapping?.validateMapping || {});
      setRecalibrateMapping(
        selectedTrial.columnMapping?.recalibrateMapping || {}
      );
      setCsvJson(selectedTrial.csvJson || []);
      setCsvColumns(selectedTrial.csvColumns || []);
    }
    // eslint-disable-next-line
  }, [selectedTrial]);

  const fieldGroupsInit = {
    pluginParameters: initCameraParams,
    initCameraInstructions: [
      {
        label: "Init Camera Instructions",
        key: "initCamerainstructions",
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
        key: "initCameraChoices",
        type: "string_array",
        default: ["Got it"],
      },
    ],
  };
  const fieldGroupsCalibrate = {
    pluginParameters: calibrateParams,
    calibrateInstructions: [
      {
        label: "Calibrate Instructions",
        key: "calibrateInstructions",
        type: "string",
        default: `
          <p>Now you'll calibrate the eye tracking, so that the software can use the image of your eyes to predict where you are looking.</p>
          <p>You'll see a series of dots appear on the screen. Look at each dot and click on it.</p>
        `,
      },
      {
        label: "Button Choices",
        key: "calibrateChoices",
        type: "string_array",
        default: ["Got it"],
      },
    ],
  };
  const fieldGroupsValidate = {
    pluginParameters: validateParams,
    validateInstructions: [
      {
        label: "Validate Instructions",
        key: "validateInstructions",
        type: "string",
        default: `
          <p>Now we'll measure the accuracy of the calibration.</p>
          <p>Look at each dot as it appears on the screen.</p>
          <p style="font-weight: bold;">You do not need to click on the dots this time.</p>
        `,
      },
      {
        label: "Button Choices",
        key: "validateChoices",
        type: "string_array",
        default: ["Got it"],
      },
      {
        label: "Post Trial Gap",
        key: "post_trial_gap",
        type: "number",
        default: 1000,
      },
    ],
  };

  const fieldGroupsRecalibrate = {
    pluginParameters: validateParams,
    recalibrateInstructions: [
      {
        label: "Recalibrate Instructions",
        key: "recalibrateInstructions",
        type: "string",
        default: `
          <p>The accuracy of the calibration is a little lower than we'd like.</p>
          <p>Let's try calibrating one more time.</p>
          <p>On the next screen, look at the dots and click on them.<p>
        `,
      },
      {
        label: "Button Choices",
        key: "recalibrateChoices",
        type: "string_array",
        default: ["OK"],
      },
    ],
  };

  // parámetros mapeados de los plugins
  const { getColumnValue: getColumnValueInit } = useCsvMapper({
    fieldGroups: fieldGroupsInit,
  });
  const { getColumnValue: getColumnValueCalibrate } = useCsvMapper({
    fieldGroups: fieldGroupsCalibrate,
  });
  const { getColumnValue: getColumnValueValidate } = useCsvMapper({
    fieldGroups: fieldGroupsValidate,
  });

  const { getColumnValue: getColumnValueRecalibrate } = useCsvMapper({
    fieldGroups: fieldGroupsRecalibrate,
  });

  // const activeParametersinitCamera = initCameraParams.filter(
  //   (p) => initCameraMapping[p.key]?.source !== "none"
  // );

  // const activeParametersCalibrate = calibrateParams.filter(
  //   (p) => calibrateMapping[p.key]?.source !== "none"
  // );

  // const activeParametersValidate = validateParams.filter(
  //   (p) => validateMapping[p.key]?.source !== "none"
  // );

  const mappedJsonInit = (() => {
    const mapRow = (row?: Record<string, any>) => {
      const result: Record<string, any> = {};

      initCameraParams.forEach((param) => {
        const { key } = param;

        result[key] = getColumnValueInit(
          initCameraMapping[key],
          row,
          undefined,
          key
        );
      });

      if (includeInitCameraInstructions) {
        fieldGroupsInit.initCameraInstructions.forEach((fixParam) => {
          result[fixParam.key] = getColumnValueInit(
            initCameraMapping[fixParam.key],
            row,
            fixParam.default,
            fixParam.key
          );
        });
      }

      return result;
    };

    if (csvJson.length > 0) {
      return csvJson.map((row) => mapRow(row));
      // } else if (needsFileUpload && filteredFiles.length > 0) {
      //   return filteredFiles.map((_, idx) => mapRow(undefined, idx));
    } else {
      return [mapRow()];
    }
  })();
  const mappedJsonCalibrate = (() => {
    const mapRow = (row?: Record<string, any>) => {
      const result: Record<string, any> = {};

      calibrateParams.forEach((param) => {
        const { key } = param;

        result[key] = getColumnValueCalibrate(
          calibrateMapping[key],
          row,
          undefined,
          key
        );
      });

      if (includeCalibrateInstructions) {
        fieldGroupsCalibrate.calibrateInstructions.forEach((fixParam) => {
          result[fixParam.key] = getColumnValueCalibrate(
            calibrateMapping[fixParam.key],
            row,
            fixParam.default,
            fixParam.key
          );
        });
      }

      return result;
    };

    if (csvJson.length > 0) {
      return csvJson.map((row) => mapRow(row));
      // } else if (needsFileUpload && filteredFiles.length > 0) {
      //   return filteredFiles.map((_, idx) => mapRow(undefined, idx));
    } else {
      return [mapRow()];
    }
  })();
  const mappedJsonValidate = (() => {
    const mapRow = (row?: Record<string, any>) => {
      const result: Record<string, any> = {};

      validateParams.forEach((param) => {
        const { key } = param;

        result[key] = getColumnValueValidate(
          validateMapping[key],
          row,
          undefined,
          key
        );
      });

      if (includeValidateInstructions) {
        fieldGroupsValidate.validateInstructions.forEach((fixParam) => {
          result[fixParam.key] = getColumnValueValidate(
            validateMapping[fixParam.key],
            row,
            fixParam.default,
            fixParam.key
          );
        });
      }

      return result;
    };

    if (csvJson.length > 0) {
      return csvJson.map((row) => mapRow(row));
      // } else if (needsFileUpload && filteredFiles.length > 0) {
      //   return filteredFiles.map((_, idx) => mapRow(undefined, idx));
    } else {
      return [mapRow()];
    }
  })();

  const mappedJsonRecalibrate = (() => {
    const mapRow = (row?: Record<string, any>) => {
      const result: Record<string, any> = {};

      if (includeRecalibrateInstructions) {
        fieldGroupsRecalibrate.recalibrateInstructions.forEach((fixParam) => {
          result[fixParam.key] = getColumnValueRecalibrate(
            recalibrateMapping[fixParam.key],
            row,
            fixParam.default,
            fixParam.key
          );
        });
      }

      return result;
    };

    if (csvJson.length > 0) {
      return csvJson.map((row) => mapRow(row));
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

  const generateTrialValidateProps = (params: any[]): string => {
    const paramProps = params
      .map(({ key }: { key: string }) => {
        return `${key}: jsPsych.timelineVariable("${key}"),`;
      })
      .join("\n");

    return `${paramProps}
    data: {
      task: 'validate'
    }`;
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

  const pluginNameImportInit = toCamelCase(initCamera);
  const pluginNameImportCalibrate = toCamelCase(calibrateWebgazer);
  const pluginNameImportValidate = toCamelCase(validateWebgazer);

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
    let code = "";

    const testStimuliCodeInit = mappedJsonInit.map((row) =>
      stringifyWithFunctions(initCameraParams, row)
    );
    code += `
    const test_stimuli_initCamera = [${testStimuliCodeInit.join(",")}];
`;
    const testStimuliCodeCalibrate = mappedJsonCalibrate.map((row) =>
      stringifyWithFunctions(calibrateParams, row)
    );
    code += `
    const test_stimuli_calibrateWebGazer = [${testStimuliCodeCalibrate.join(
      ","
    )}];
`;
    const testStimuliCodeValidate = mappedJsonValidate.map((row) =>
      stringifyWithFunctions(validateParams, row)
    );
    code += `
    const test_stimuli_validateWebGazer = [${testStimuliCodeValidate.join(
      ","
    )}];
`;
    if (includeInitCameraInstructions) {
      code += `const initCamera_instructions = {
      type: jsPsychHtmlButtonResponse,
      stimulus: jsPsych.timelineVariable("initCamerainstructions"),
      choices: jsPsych.timelineVariable("initCameraChoices"),
    };`;
    }
    const timelinePropsInit = generateTrialProps(
      initCameraParams,
      initCameraData
    );

    if (includeCalibrateInstructions) {
      code += `const calibrateWebGazer_instructions = {
      type: jsPsychHtmlButtonResponse,
      stimulus: jsPsych.timelineVariable("calibrateInstructions"),
      choices: jsPsych.timelineVariable("calibrateChoices"),
    };`;
    }
    const timelinePropsCalibrate = generateTrialProps(
      calibrateParams,
      calibrateData
    );

    if (includeValidateInstructions) {
      code += `const validateWebGazer_instructions = {
      type: jsPsychHtmlButtonResponse,
      stimulus: jsPsych.timelineVariable("validateInstructions"),
      choices: jsPsych.timelineVariable("validateChoices"),
      post_trial_gap: jsPsych.timelineVariable("post_trial_gap"),
    };`;
    }
    const timelinePropsValidate = generateTrialValidateProps(validateParams);

    // initCamera

    code += ` const initCamera_timeline = {
    type: ${pluginNameImportInit}, ${timelinePropsInit}};`;

    code += `const initCamera_procedure = {
    timeline: 
    [${
      includeInitCameraInstructions ? `initCamera_instructions,` : ""
    }initCamera_timeline],
    timeline_variables: test_stimuli_initCamera,
  };
    timeline.push(initCamera_procedure);
  ;`;

    // Calibrate

    code += ` const calibrateWebGazer_timeline = {
    type: ${pluginNameImportCalibrate}, ${timelinePropsCalibrate}};`;

    code += `const calibrateWebGazer_procedure = {
    timeline: 
    [${
      includeCalibrateInstructions ? `calibrateWebGazer_instructions,` : ""
    }calibrateWebGazer_timeline],
    timeline_variables: test_stimuli_calibrateWebGazer,
  };
    timeline.push(calibrateWebGazer_procedure);
  ;`;

    // Validate

    code += ` const validateWebGazer_timeline = {
    type: ${pluginNameImportValidate}, ${timelinePropsValidate}};`;

    code += `const validateWebGazer_procedure = {
    timeline: 
    [${
      includeValidateInstructions ? `validateWebGazer_instructions,` : ""
    }validateWebGazer_timeline],
    timeline_variables: test_stimuli_validateWebGazer,
  };
    timeline.push(validateWebGazer_procedure);
  ;`;

    // Recalibrate

    const testStimuliCodeRecalibrate = mappedJsonRecalibrate.map((row) =>
      stringifyWithFunctions(validateParams, row)
    );
    code += `
    const test_stimuli_recalibrate = [${testStimuliCodeRecalibrate.join(",")}];
`;

    if (includeRecalibrateInstructions) {
      code += `const recalibrate_instructions = {
      type: jsPsychHtmlButtonResponse,
      stimulus: jsPsych.timelineVariable("recalibrateInstructions"),
      choices: jsPsych.timelineVariable("recalibrateChoices"),
    };`;
    }

    code += `
    const recalibrate_timeline = {
        timeline: [recalibrate_instructions, calibrateWebGazer_procedure, validateWebGazer_procedure],
        conditional_function: function(){
          var validation_data = jsPsych.data.get().filter({task: 'validate'}).values()[0];
          return validation_data.percent_in_roi.some(function(x){
            var minimum_percent_acceptable = 50;
            return x < minimum_percent_acceptable;
          });
        },
        data: {
          phase: 'recalibration'
        }
      }`;

    code += ` \n const recalibrateWebGazer_procedure = {
    timeline: 
    [${
      includeRecalibrateInstructions ? `recalibrate_instructions,` : ""
    }recalibrate_timeline],
    timeline_variables: test_stimuli_recalibrate,
  };
    timeline.push(recalibrateWebGazer_procedure);
  ;`;

    `const calibration_done = {
        type: jsPsychHtmlButtonResponse,
        stimulus: \`
          <p>Great, we're done with calibration!</p>
        \`,
        choices: ['OK']
      }
    timeline.push(calibration_done);
`;

    return code;
  };

  // guardar y actualizar el estado global del ensayo
  const handleSave = () => {
    const trialIndex = trials.findIndex((t) => t.name === trialName);
    if (trialIndex === -1) return;

    const updatedTrial = {
      ...trials[trialIndex],
      plugin: "webgazer",
      parameters: {
        include_instructions: {
          includeInitCameraInstructions,
          includeCalibrateInstructions,
          includeValidateInstructions,
          includeRecalibrateInstructions,
        },
      },
      trialCode: genTrialCode(),
      columnMapping: {
        initCameraMapping,
        calibrateMapping,
        validateMapping,
        recalibrateMapping,
      },
      csvJson: [...csvJson],
      csvColumns: [...csvColumns],
    };

    const updatedTrials = [...trials];
    updatedTrials[trialIndex] = updatedTrial;
    setTrials(updatedTrials);
    setSelectedTrial(updatedTrial);

    window.alert("Ensayo guardado exitosamente.");
    console.log(csvJson);
    console.log(genTrialCode());
  };

  const deleteCsv = () => {
    if (csvJson.length === 0) return;
    setCsvJson([]);
    setCsvColumns([]);
  };

  const canSave = !!trialName;

  return (
    <div id="plugin-config">
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
        <div className="input-section p-4 border rounded">
          <h4 className="text-lg font-bold mb-3"> {initCamera} </h4>
          <InstructionsConfig
            includeInstructions={includeInitCameraInstructions}
            setIncludeInstructions={setIncludeInitCameraInstructions}
            instructionsFields={fieldGroupsInit.initCameraInstructions}
            columnMapping={initCameraMapping}
            setColumnMapping={setInitCameraMapping}
            csvColumns={csvColumns}
          />

          {/* Parameter section */}
          <ParameterMapper
            pluginName={initCamera}
            parameters={initCameraParams}
            columnMapping={initCameraMapping}
            setColumnMapping={setInitCameraMapping}
            csvColumns={csvColumns}
          />
        </div>

        <div className="input-section p-4 border rounded">
          <h4 className="text-lg font-bold mb-3"> {calibrateWebgazer} </h4>

          <InstructionsConfig
            includeInstructions={includeCalibrateInstructions}
            setIncludeInstructions={setIncludeCalibrateInstructions}
            instructionsFields={fieldGroupsCalibrate.calibrateInstructions}
            columnMapping={calibrateMapping}
            setColumnMapping={setCalibrateMapping}
            csvColumns={csvColumns}
          />

          {/* Parameter section */}
          <ParameterMapper
            pluginName={calibrateWebgazer}
            parameters={calibrateParams}
            columnMapping={calibrateMapping}
            setColumnMapping={setCalibrateMapping}
            csvColumns={csvColumns}
          />
        </div>

        <div className=" input-section p-4 border rounded">
          <h4 className="text-lg font-bold mb-3"> {validateWebgazer} </h4>

          <InstructionsConfig
            includeInstructions={includeValidateInstructions}
            setIncludeInstructions={setIncludeValidateInstructions}
            instructionsFields={fieldGroupsValidate.validateInstructions}
            columnMapping={validateMapping}
            setColumnMapping={setValidateMapping}
            csvColumns={csvColumns}
          />

          {/* Parameter section */}
          <ParameterMapper
            pluginName={validateWebgazer}
            parameters={validateParams}
            columnMapping={validateMapping}
            setColumnMapping={setValidateMapping}
            csvColumns={csvColumns}
          />
        </div>

        <div className=" input-section p-4 border rounded">
          <h4 className="text-lg font-bold mb-3"> Recalibrate </h4>

          <InstructionsConfig
            includeInstructions={includeRecalibrateInstructions}
            setIncludeInstructions={setIncludeRecalibrateInstructions}
            instructionsFields={fieldGroupsRecalibrate.recalibrateInstructions}
            columnMapping={calibrateMapping}
            setColumnMapping={setCalibrateMapping}
            csvColumns={csvColumns}
          />
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

export default WebGazer;
