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
    return str
      .replace(/^plugin/, "jsPsych") // elimina el prefijo "plugin-" y agrega "jsPsych"
      .split("-") // divide el string por guiones
      .map((word, index) =>
        index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
      )
      .join("");
  }

  const trialsData =
    loop?.trials.map((trial: any) => {
      // debugger;
      const { parameters, data } = usePluginParameters(trial.plugin);
      const fieldGroups = {
        pluginParameters: parameters,
      };
      const { getColumnValue } = useCsvMapper({
        fieldGroups: fieldGroups,
      });

      const { genTrialCode } = useTrialCode({
        pluginName: trial.plugin,
        parameters: parameters,
        data: data,
        getColumnValue: getColumnValue,
        needsFileUpload: trial.needsFileUpload || false,
        columnMapping: trial.columnMapping || {},
        filteredFiles: trial.filteredFiles || [],
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
      };
    }) || [];

  // Usar useLoopCode con los datos generados
  const generateLoopCode = useLoopCode({
    repetitions,
    randomize,
    trials: trialsData,
  });

  const loopCode = generateLoopCode();

  useEffect(() => {
    if (!loop || isLoadingLoop) return;

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
      setTimeout(() => setSaveIndicator(false), 2000);
    }, 1000);
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
        {/* Delete Loop */}
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
