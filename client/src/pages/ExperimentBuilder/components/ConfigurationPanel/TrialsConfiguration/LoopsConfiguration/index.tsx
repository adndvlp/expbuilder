import { useEffect, useRef, useState } from "react";
import Switch from "react-switch";
import OrdersAndCategories from "../OrdersAndCategories";
import CsvUploader from "../Csv/CsvUploader";
import { useCsvData } from "../Csv/useCsvData";
import { useOrdersAndCategories } from "../OrdersAndCategories/useOrdersAndCategories";
import { Loop, LoopCondition } from "../../types";
import useTrials from "../../../../hooks/useTrials";
import ConditionalLoop from "./ConditionalLoop";

type Props = { loop?: Loop };

function LoopsConfig({ loop }: Props) {
  const { updateLoop, updateLoopField, deleteLoop } = useTrials();

  const [isLoadingLoop, setIsLoadingLoop] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [saveIndicator, setSaveIndicator] = useState(false);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [showConditionalModal, setShowConditionalModal] = useState(false);

  const [repetitions, setRepetitions] = useState<number>(
    loop?.repetitions || 1,
  );
  const [randomize, setRandomize] = useState<boolean>(loop?.randomize || false);
  const [isConditionalLoop, setIsConditionalLoop] = useState<boolean>(
    loop?.isConditionalLoop || false,
  );
  const [loopConditions, setLoopConditions] = useState<LoopCondition[]>(
    loop?.loopConditions || [],
  );

  const { csvJson, setCsvJson, csvColumns, setCsvColumns, handleCsvUpload } =
    useCsvData();
  const deleteCsv = () => {
    if (csvJson.length === 0) return;
    setCsvJson([]);
    setCsvColumns([]);
    saveCsvData([], []);
  };

  useEffect(() => {
    if (!loop) return;

    setIsLoadingLoop(true);

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
    setTimeout(() => setIsLoadingLoop(false), 100); // 500 in production
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop]);

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
  } = useOrdersAndCategories();

  const canSave = !!loop && !isLoadingLoop;

  const showSaveIndicator = (fieldName?: string) => {
    setSavingField(fieldName || null);
    setSaveIndicator(true);
    setTimeout(() => {
      setSaveIndicator(false);
      setSavingField(null);
    }, 1500);
  };

  const saveField = async (fieldName: string, value: any) => {
    if (!loop) return;
    const success = await updateLoopField(loop.id, fieldName, value);
    if (success) {
      showSaveIndicator(fieldName);
    }
  };

  const saveCsvData = async (dataToSave?: any[], colsToSave?: string[]) => {
    if (!loop) return;

    const finalJson = dataToSave !== undefined ? dataToSave : csvJson;
    const finalCols = colsToSave !== undefined ? colsToSave : csvColumns;

    await updateLoopField(
      loop.id,
      "csvJson",
      finalJson ? [...finalJson] : [],
      false,
    );
    await updateLoopField(
      loop.id,
      "csvColumns",
      finalCols ? [...finalCols] : [],
      false,
    );
    showSaveIndicator("csv");
  };

  const onHandleCsvUploadWrapped = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleCsvUpload(e, (newData, newCols) => {
      saveCsvData(newData, newCols);
    });
  };

  const saveLoopOrders = async (
    ord: boolean,
    ordCols: string[],
    stimOrd: any[],
    cat: boolean,
    catCol: string,
    catData: any[],
  ) => {
    if (!loop) return;

    // Use updateLoop for 1 PATCH with all fields
    const updatedLoop = await updateLoop(loop.id, {
      orders: ord,
      orderColumns: ordCols,
      stimuliOrders: stimOrd,
      categories: cat,
      categoryColumn: catCol,
      categoryData: catData,
    });

    if (updatedLoop) {
      showSaveIndicator("orders");
    }
  };

  const handleSave = async () => {
    if (!canSave || !loop) return;

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
    };

    try {
      await updateLoop(loop.id, updatedLoopData);
      showSaveIndicator();
    } catch (error) {
      console.error("Error saving loop:", error);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    const timeoutCurrent = timeoutRef.current;
    return () => {
      if (timeoutCurrent) clearTimeout(timeoutCurrent);
    };
  }, []);

  const handleSaveLoopConditions = async (conditions: LoopCondition[]) => {
    setLoopConditions(conditions);
    setIsConditionalLoop(conditions.length > 0);

    // Save automatically when conditions are configured
    if (loop) {
      await updateLoop(loop.id, {
        loopConditions: conditions,
        isConditionalLoop: conditions.length > 0,
      });
      showSaveIndicator("loop conditions");
    }
  };

  const handleRemoveLoop = async () => {
    if (
      window.confirm(
        "Are you sure you want to delete this loop? This action cannot be undone.",
      ) &&
      loop
    ) {
      try {
        await deleteLoop(loop.id);
      } catch (error) {
        console.error("Error deleting loop:", error);
      }
    }
  };

  return (
    <div id="loop-config">
      <div className="mb-1 input-section p-4 border rounded">
        <h4 className="text-lg font-bold mb-3">{loop?.name || "Loop"}</h4>
        <div className="mb-2">
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
            ✓ Saved {savingField ? `(${savingField})` : "Loop"}
          </div>
          <strong>Trials in loop:</strong> {loop?.trials?.length || 0} trial(s)
        </div>

        <CsvUploader
          onCsvUpload={onHandleCsvUploadWrapped}
          csvJson={csvJson}
          onDeleteCSV={deleteCsv}
        />

        <OrdersAndCategories
          stimuliOrders={stimuliOrders}
          categoryData={categoryData}
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
          onSave={saveLoopOrders}
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
                  Math.floor(Number(e.target.value)) || 1,
                );
                setRepetitions(val);
              }}
              onBlur={() => saveField("repetitions", repetitions)}
              className="mr-2"
              placeholder="1"
              style={{ width: "100%" }}
            />
          </div>
          <div className="flex items-center" style={{ gap: "12px" }}>
            <Switch
              checked={randomize}
              onChange={(checked) => {
                setRandomize(checked);
                saveField("randomize", checked);
              }}
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
                  if (loop) {
                    // Guardar ambos campos cuando se desactiva
                    updateLoop(loop.id, {
                      isConditionalLoop: false,
                      loopConditions: [],
                    }).then(() => showSaveIndicator("loop conditions"));
                  }
                } else {
                  saveField("isConditionalLoop", checked);
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
                loop={loop as any}
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
