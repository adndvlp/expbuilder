import { useEffect, useRef, useState } from "react";
import TrialOrders from "../TrialOrders";
import CsvUploader from "../CsvUploader";
import { useCsvData } from "../hooks/useCsvData";
import { useTrialOrders } from "../hooks/useTrialOrders";
import { Loop } from "../../types";
import useTrials from "../../../../hooks/useTrials";
import isEqual from "lodash.isequal";
import useLoopCode from "./useLoopCode";
import { useTrialCode } from "../hooks/useTrialCode";
import { usePluginParameters } from "../../hooks/usePluginParameters";
import { useCsvMapper } from "../hooks/useCsvMapper";
import { useFileUpload } from "../hooks/useFileUpload";

type Props = { loop?: Loop };

function LoopsConfig({ loop }: Props) {
  const { trials, setTrials, removeLoop } = useTrials();

  const [isLoadingLoop, setIsLoadingLoop] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [saveIndicator, setSaveIndicator] = useState(false);

  const [repetitions, setRepetitions] = useState<number>(
    loop?.repetitions || 1
  );
  const [randomize, setRandomize] = useState<boolean>(loop?.randomize || false);

  const { csvJson, setCsvJson, csvColumns, setCsvColumns, handleCsvUpload } =
    useCsvData();
  const deleteCsv = () => {
    setCsvJson([]);
    setCsvColumns([]);
  };

  useEffect(() => {
    if (!loop) return;

    setIsLoadingLoop(true);

    // Restaura los datos del loop
    setRepetitions(loop.repetitions ?? 1);
    setRandomize(loop.randomize ?? false);
    setCsvJson(loop.csvJson ?? []);
    setCsvColumns(loop.csvColumns ?? []);
    setOrders(loop.orders ?? false);
    setCategories(loop.categories ?? false);
    setOrderColumns(loop.orderColumns ?? []);
    mapOrdersFromCsv(loop.csvJson ?? [], loop.orderColumns ?? []);
    setCategoryColumn(loop.categoryColumn ?? "");
    mapCategoriesFromCsv(loop.csvJson ?? [], loop.categoryColumn ?? "");
    setTimeout(() => setIsLoadingLoop(false), 100); // 500 en producción
  }, [loop]);

  const handleCsvUploadLoop = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleCsvUpload(e); // actualiza el csvJson y csvColumns del loop

    // Propaga el CSV del loop a los trials dentro del loop
    if (loop) {
      setTrials(
        trials.map((item) => {
          if ("trials" in item && item.id === loop.id) {
            return {
              ...item,
              csvJson: csvJson,
              csvColumns: csvColumns,
              trials: item.trials.map((trial) => ({
                ...trial,
                prevCsvJson: trial.csvJson, // guarda el anterior
                prevCsvColumns: trial.csvColumns,
                csvJson: csvJson,
                csvColumns: csvColumns,
                csvFromLoop: true,
              })),
            };
          }
          return item;
        })
      );
    }
  };

  const {
    orders,
    setOrders,
    orderColumns,
    setOrderColumns,
    mapOrdersFromCsv,
    stimuliOrders,
    categories,
    setCategories,
    categoryColumn,
    setCategoryColumn,
    categoryData,
    mapCategoriesFromCsv,
  } = useTrialOrders();

  function toCamelCase(str: string): string {
    if (!str) return "";
    return str
      .replace(/^plugin/, "jsPsych") // elimina el prefijo "plugin-" y agrega "jsPsych"
      .split("-") // divide el string por guiones
      .map((word, index) =>
        index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
      )
      .join("");
  }

  const trialsData =
    loop?.trials
      .filter((trial: any) => trial.plugin) // Filter out trials without plugin
      .map((trial: any) => {
        // debugger;
        const { parameters, data } = usePluginParameters(trial.plugin);
        const fieldGroups = {
          pluginParameters: parameters,
        };
        const { getColumnValue } = useCsvMapper({
          fieldGroups: fieldGroups,
        });

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
            trial.plugin
          ) || hasMediaParameters(parameters);

        const getFileTypeAndFolder = () => {
          if (/plugin-audio/i.test(trial.plugin)) {
            return { accept: "audio/*", folder: "aud" };
          }
          if (/plugin-video/i.test(trial.plugin)) {
            return { accept: "video/*", folder: "vid" };
          }

          if (/plugin-preload/i.test(trial.plugin)) {
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

        const { folder } = getFileTypeAndFolder();

        const { uploadedFiles } = useFileUpload({ folder });

        const filteredFiles = uploadedFiles.filter(
          (file) =>
            file &&
            typeof file === "object" &&
            typeof file.name === "string" &&
            (folder === "all" || file.type === folder)
        );

        const { genTrialCode, mappedJson } = useTrialCode({
          id: trial.id,
          branches: trial.branches,
          branchConditions: trial.branchConditions,
          pluginName: trial.plugin,
          parameters: parameters,
          data: data,
          getColumnValue: getColumnValue,
          needsFileUpload: needsFileUpload || false,
          columnMapping: trial.columnMapping || {},
          filteredFiles: filteredFiles || [],
          csvJson: trial.csvJson ?? [],
          trialName: trial.name,
          includesExtensions: trial.includesExtensions || false,
          extensions: trial.extensions || "",
          orders: orders,
          stimuliOrders: stimuliOrders,
          categories: categories,
          categoryData: categoryData,
          isInLoop: true,
        });

        return {
          trialName: trial.name,
          pluginName: toCamelCase(trial.plugin),
          timelineProps: genTrialCode(),
          mappedJson,
        };
      }) || [];

  function mergeStimuliArrays(arrays: Record<string, any>[][]) {
    const maxLength = Math.max(...arrays.map((arr) => arr.length));
    const merged: Record<string, any>[] = [];
    for (let i = 0; i < maxLength; i++) {
      const obj: Record<string, any> = {};
      arrays.forEach((arr) => {
        Object.assign(obj, arr[i] || {});
      });
      merged.push(obj);
    }
    return merged;
  }

  const unifiedStimuli = mergeStimuliArrays(
    trialsData.map((t) => t.mappedJson)
  );

  // Usar useLoopCode con los datos generados
  const generateLoopCode = useLoopCode({
    id: loop?.id,
    branches: loop?.branches,
    branchConditions: loop?.branchConditions,
    repetitions,
    randomize,
    orders,
    stimuliOrders,
    categories,
    categoryData,
    trials: trialsData,
    unifiedStimuli,
  });

  const loopCode = generateLoopCode();

  const canSave = !!loop && !isLoadingLoop;

  const handleSave = () => {
    // if (!loop || isLoadingLoop) return;
    if (!canSave) return;

    const loopIndex = trials.findIndex(
      (item) => "trials" in item && item.id === loop.id
    );
    if (loopIndex === -1) return;

    const prevLoop = trials[loopIndex];

    // console.log(loopCode);

    const updatedLoop = {
      ...prevLoop,
      repetitions,
      randomize,
      csvJson,
      csvColumns,
      orders,
      orderColumns,
      categories,
      categoryColumn,
      stimuliOrders,
      categoryData,
      code: loopCode,
    };

    if (isEqual(updatedLoop, prevLoop)) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      const updatedTrials = [...trials];
      updatedTrials[loopIndex] = updatedLoop;
      setTrials(updatedTrials);

      setSaveIndicator(true);
      console.log(loopCode);
      setTimeout(() => setSaveIndicator(false), 2000);
    }, 1000);
  };

  useEffect(() => {
    handleSave();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [
    repetitions,
    randomize,
    csvJson,
    csvColumns,
    orders,
    orderColumns,
    categories,
    categoryColumn,
    isLoadingLoop,
  ]);

  return (
    <div id="loop-config">
      <div className="mb-1 input-section p-4 border rounded">
        <h4 className="text-lg font-bold mb-3">{loop?.name || "Loop"}</h4>
        <div className="mb-2">
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
            ✓ Saved Loop
          </div>
          <strong>Trials en loop:</strong>{" "}
          {loop?.trials.map((t) => t.name).join(", ")}
        </div>

        {/* CSV and XLSX section */}
        <CsvUploader
          onCsvUpload={handleCsvUploadLoop}
          csvJson={csvJson}
          onDeleteCSV={deleteCsv}
        />

        {/* Orders */}
        <TrialOrders
          orders={orders}
          setOrders={setOrders}
          columnOptions={csvColumns}
          orderColumns={orderColumns}
          setOrderColumns={setOrderColumns}
          mapOrdersFromCsv={mapOrdersFromCsv}
          categories={categories}
          setCategories={setCategories}
          categoryColumn={categoryColumn}
          setCategoryColumn={setCategoryColumn}
          mapCategoriesFromCsv={mapCategoriesFromCsv}
          csvJson={csvJson}
        />

        {/* Repetitions y Randomize */}
        <div className="mb-2 p-4 border rounded bg-gray-50">
          <div className="flex items-center mb-3">
            <div className="font-bold mr-2 mb-2">Repetitions</div>
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
              style={{ width: "100%" }}
            />
          </div>
          <div className="flex items-center">
            <div className="font-bold mr-2">Randomize</div>
            <input
              type="checkbox"
              checked={randomize}
              onChange={(e) => setRandomize(e.target.checked)}
              className="ml-2"
            />
          </div>
        </div>
        {/* Save and Delete Loop */}
        <button
          onClick={handleSave}
          className="mt-4 save-button mb-4 w-full p-3 bg-green-600 hover:bg-green-700 font-medium rounded"
          disabled={!canSave}
        >
          Save loop
        </button>

        <br />
        <button
          className="remove-button"
          onClick={() => removeLoop && loop && removeLoop(loop.id)}
        >
          Delete loop
        </button>
      </div>
    </div>
  );
}

export default LoopsConfig;
