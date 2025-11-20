import { useEffect, useRef, useState } from "react";
import Switch from "react-switch";
import TrialOrders from "../TrialOrders";
import CsvUploader from "../CsvUploader";
import { useCsvData } from "../hooks/useCsvData";
import { useTrialOrders } from "../hooks/useTrialOrders";
import { Loop, LoopCondition } from "../../types";
import useTrials from "../../../../hooks/useTrials";
import isEqual from "lodash.isequal";
import useLoopCode from "./useLoopCode";
import { useTrialCode } from "../hooks/useTrialCode";
import { usePluginParameters } from "../../hooks/usePluginParameters";
import { useCsvMapper } from "../hooks/useCsvMapper";
import { useFileUpload } from "../../../Timeline/useFileUpload";
import ConditionalLoop from "./ConditionalLoop";

type Props = { loop?: Loop };

function LoopsConfig({ loop }: Props) {
  const { trials, setTrials, removeLoop } = useTrials();

  const [isLoadingLoop, setIsLoadingLoop] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [saveIndicator, setSaveIndicator] = useState(false);
  const [showConditionalModal, setShowConditionalModal] = useState(false);

  const [repetitions, setRepetitions] = useState<number>(
    loop?.repetitions || 1
  );
  const [randomize, setRandomize] = useState<boolean>(loop?.randomize || false);
  const [isConditionalLoop, setIsConditionalLoop] = useState<boolean>(
    loop?.isConditionalLoop || false
  );
  const [loopConditions, setLoopConditions] = useState<LoopCondition[]>(
    loop?.loopConditions || []
  );

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
    setIsConditionalLoop(loop.isConditionalLoop ?? false);
    setLoopConditions(loop.loopConditions ?? []);
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

  // Procesar SOLO los trials directos del loop (sin entrar en loops anidados)
  // Los loops anidados se procesarán cuando se abra su propio LoopsConfig
  const directTrials = loop?.trials.filter((item: any) => item.plugin) || [];

  // Procesar trials directos con hooks
  const trialsData = directTrials.map((trial: any) => {
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

    const { genTrialCode, mappedJson } = useTrialCode({
      id: trial.id,
      branches: trial.branches,
      branchConditions: trial.branchConditions,
      repeatConditions: trial.repeatConditions,
      paramsOverride: trial.paramsOverride,
      pluginName: trial.plugin,
      parameters: parameters,
      data: data,
      getColumnValue: getColumnValue,
      columnMapping: trial.columnMapping || {},
      uploadedFiles: uploadedFiles || [],
      csvJson: trial.csvJson ?? [],
      trialName: trial.name,
      includesExtensions: trial.includesExtensions || false,
      extensions: trial.extensions || "",
      orders: orders,
      stimuliOrders: stimuliOrders,
      categories: categories,
      categoryData: categoryData,
      isInLoop: true,
      parentLoopId: loop?.id, // Pasar el ID del loop padre
    });

    return {
      trialName: trial.name,
      pluginName: toCamelCase(trial.plugin),
      timelineProps: genTrialCode(),
      mappedJson,
    };
  });

  // Función RECURSIVA para procesar trials dentro de loops anidados
  const processNestedTrials = (items: any[], parentLoopId?: string): any[] => {
    return items
      .map((item: any) => {
        // Si es un loop anidado
        if ("trials" in item && !item.plugin) {
          // Procesar recursivamente los trials dentro del loop anidado
          const nestedProcessedItems = processNestedTrials(
            item.trials,
            item.id
          ); // Pasar el ID del nested loop

          // Calcular unifiedStimuli para el loop anidado
          const nestedUnifiedStimuli = mergeStimuliArrays(
            nestedProcessedItems
              .filter((i: any) => !i.isLoop && i.mappedJson)
              .map((i: any) => i.mappedJson || [])
          );

          return {
            loopName: item.name,
            loopId: item.id,
            repetitions: item.repetitions || 1,
            randomize: item.randomize || false,
            orders: item.orders || false,
            stimuliOrders: item.stimuliOrders || [],
            categories: item.categories || false,
            categoryData: item.categoryData || [],
            branches: item.branches,
            branchConditions: item.branchConditions,
            repeatConditions: item.repeatConditions,
            loopConditions: item.loopConditions || [],
            isConditionalLoop: item.isConditionalLoop || false,
            items: nestedProcessedItems, // Ahora contiene los trials/loops procesados recursivamente
            unifiedStimuli: nestedUnifiedStimuli,
            isLoop: true as const,
          };
        }

        // Si es un trial, procesarlo con hooks
        const { parameters, data } = usePluginParameters(item.plugin);
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

        const getFileTypeAndFolder = () => {
          if (/plugin-audio/i.test(item.plugin)) {
            return { accept: "audio/*", folder: "aud" };
          }
          if (/plugin-video/i.test(item.plugin)) {
            return { accept: "video/*", folder: "vid" };
          }
          if (/plugin-preload/i.test(item.plugin)) {
            return { accept: "audio/*,video/*,image/*", folder: "all" };
          }

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

            if ([hasAudio, hasVideo, hasImage].filter(Boolean).length > 1) {
              return { accept: "audio/*,video/*,image/*", folder: "all" };
            }

            if (hasAudio) return { accept: "audio/*", folder: "aud" };
            if (hasVideo) return { accept: "video/*", folder: "vid" };
            if (hasImage) return { accept: "image/*", folder: "img" };
          }

          return { accept: "image/*", folder: "img" };
        };

        const { folder } = getFileTypeAndFolder();
        const { uploadedFiles } = useFileUpload({ folder });

        const { genTrialCode, mappedJson } = useTrialCode({
          id: item.id,
          branches: item.branches,
          branchConditions: item.branchConditions,
          repeatConditions: item.repeatConditions,
          paramsOverride: item.paramsOverride,
          pluginName: item.plugin,
          parameters: parameters,
          data: data,
          getColumnValue: getColumnValue,
          columnMapping: item.columnMapping || {},
          uploadedFiles: uploadedFiles || [],
          csvJson: item.csvJson ?? [],
          trialName: item.name,
          includesExtensions: item.includesExtensions || false,
          extensions: item.extensions || "",
          orders: orders,
          stimuliOrders: stimuliOrders,
          categories: categories,
          categoryData: categoryData,
          isInLoop: true,
          parentLoopId: parentLoopId, // Pasar el ID del loop padre
        });

        return {
          trialName: item.name,
          pluginName: toCamelCase(item.plugin),
          timelineProps: genTrialCode(),
          mappedJson,
        };
      })
      .filter(Boolean);
  };

  // Construir la estructura completa con loops anidados procesados recursivamente
  const structuredData = loop?.trials
    ? processNestedTrials(loop.trials, loop.id) // Pasar el ID del loop principal
    : trialsData;

  const unifiedStimuli = mergeStimuliArrays(
    trialsData.map((t) => t.mappedJson || [])
  );

  // Usar useLoopCode con los datos estructurados (incluye loops anidados)
  const generateLoopCode = useLoopCode({
    id: loop?.id,
    branches: loop?.branches,
    branchConditions: loop?.branchConditions,
    repeatConditions: loop?.repeatConditions,
    repetitions,
    randomize,
    orders,
    stimuliOrders,
    categories,
    categoryData,
    trials: structuredData, // Usar la estructura con loops anidados
    unifiedStimuli,
    loopConditions,
    isConditionalLoop,
    parentLoopId: null, // Este es un loop raíz, no tiene padre
  });

  const loopCode = generateLoopCode();

  const canSave = !!loop && !isLoadingLoop;

  // Función recursiva para actualizar un loop en cualquier nivel de anidación
  const updateLoopRecursive = (
    items: any[],
    targetLoopId: string | number
  ): any[] => {
    return items.map((item) => {
      // Si es el loop que buscamos, actualizarlo
      if ("trials" in item && item.id === targetLoopId) {
        return {
          ...item,
          repetitions,
          randomize,
          isConditionalLoop,
          loopConditions,
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
      }
      // Si es un loop pero no es el que buscamos, buscar recursivamente en sus trials
      if ("trials" in item && Array.isArray(item.trials)) {
        return {
          ...item,
          trials: updateLoopRecursive(item.trials, targetLoopId),
        };
      }
      // Si es un trial, devolverlo sin cambios
      return item;
    });
  };

  const handleSave = () => {
    // if (!loop || isLoadingLoop) return;
    if (!canSave) return;

    // Buscar el loop en el primer nivel
    const loopIndex = trials.findIndex(
      (item) => "trials" in item && item.id === loop.id
    );

    // Crear el objeto actualizado del loop
    const updatedLoopData = {
      repetitions,
      randomize,
      isConditionalLoop,
      loopConditions,
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

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      let updatedTrials: any[];

      if (loopIndex !== -1) {
        // Loop está en el primer nivel
        const prevLoop = trials[loopIndex];
        const updatedLoop = {
          ...prevLoop,
          ...updatedLoopData,
        };

        if (isEqual(updatedLoop, prevLoop)) return;

        updatedTrials = [...trials];
        updatedTrials[loopIndex] = updatedLoop;
      } else {
        // Loop está anidado - buscar recursivamente
        updatedTrials = updateLoopRecursive(trials, loop.id);
      }

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
    isConditionalLoop,
    loopConditions,
    csvJson,
    csvColumns,
    orders,
    orderColumns,
    categories,
    categoryColumn,
    isLoadingLoop,
  ]);

  const handleSaveLoopConditions = (conditions: LoopCondition[]) => {
    setLoopConditions(conditions);
    setIsConditionalLoop(conditions.length > 0);
  };

  const handleRemoveLoop = () => {
    if (
      window.confirm(
        "Are you sure you want to delete this loop? This action cannot be undone."
      ) &&
      removeLoop &&
      loop
    ) {
      removeLoop(loop.id);
    }
  };

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
          <div className="flex items-center" style={{ gap: "12px" }}>
            <Switch
              checked={randomize}
              onChange={(checked) => setRandomize(checked)}
              onColor="#f1c40f"
              onHandleColor="#ffffff"
              handleDiameter={24}
              uncheckedIcon={false}
              checkedIcon={false}
              height={20}
              width={44}
            />
            <div className="font-bold">Randomize</div>
          </div>
        </div>

        {/* Loop Conditions Section */}
        <div className="mb-2 p-4 border rounded bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-bold mb-1">Loop Conditions</div>
              <p className="text-sm text-gray-600">
                Make this loop repeat based on trial data
              </p>
            </div>
            <Switch
              checked={isConditionalLoop}
              onChange={(checked) => {
                setIsConditionalLoop(checked);
                if (!checked) {
                  setLoopConditions([]);
                }
              }}
              onColor="#f1c40f"
              onHandleColor="#ffffff"
              handleDiameter={24}
              uncheckedIcon={false}
              checkedIcon={false}
              height={20}
              width={44}
            />
          </div>

          {isConditionalLoop && (
            <div className="mt-3">
              <button
                onClick={() => setShowConditionalModal(true)}
                className="w-full p-3 rounded font-medium transition"
                style={{
                  background:
                    "linear-gradient(135deg, var(--primary-blue), var(--light-blue))",
                  color: "var(--text-light)",
                }}
              >
                {loopConditions.length > 0
                  ? `Edit Loop Conditions (${loopConditions.length})`
                  : "Configure Loop Conditions"}
              </button>
              {loopConditions.length > 0 && (
                <div className="mt-2 text-sm text-gray-600">
                  <strong>Active conditions:</strong> {loopConditions.length}{" "}
                  condition(s) configured
                </div>
              )}
            </div>
          )}
        </div>

        {/* Conditional Loop Modal */}
        {showConditionalModal && loop && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
            }}
            onClick={() => setShowConditionalModal(false)}
          >
            <div onClick={(e) => e.stopPropagation()}>
              <ConditionalLoop
                loop={loop}
                onClose={() => setShowConditionalModal(false)}
                onSave={handleSaveLoopConditions}
              />
            </div>
          </div>
        )}

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
          className="w-full p-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded remove-button"
          onClick={handleRemoveLoop}
        >
          Delete loop
        </button>
      </div>
    </div>
  );
}

export default LoopsConfig;
