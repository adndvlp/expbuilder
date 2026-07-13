import { useEffect, useRef, useState } from "react";
import OrdersAndCategories from "../OrdersAndCategories";
import CsvUploader from "../Csv/CsvUploader";
import { useCsvData } from "../Csv/useCsvData";
import { useOrdersAndCategories } from "../OrdersAndCategories/useOrdersAndCategories";
import { Loop, LoopCondition } from "../../types";
import useTrials from "../../../../hooks/useTrials";
import LoopBasicsSection from "./components/LoopBasicsSection";
import LoopConditionsSection from "./components/LoopConditionsSection";
import LoopActions from "./components/LoopActions";
import LoopHeader from "./components/LoopHeader";

type Props = { loop?: Loop };

function LoopsConfig({ loop }: Props) {
  const { updateLoop, updateLoopField, deleteLoop, updateTrialField } =
    useTrials();

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
  const deleteCsv = async () => {
    if (csvJson.length === 0) return;
    setCsvJson([]);
    setCsvColumns([]);
    await saveCsvData([], []);
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
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setSaveIndicator(false);
      setSavingField(null);
      timeoutRef.current = null;
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

    if (loop.trials && loop.trials.length > 0) {
      const hasCsv = finalJson.length > 0;

      for (const trialId of loop.trials) {
        await updateTrialField(
          trialId,
          "csvFromLoop",
          hasCsv,
          false, // no actualizar selectedTrial automáticamente
        );
      }
    }

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
    /* v8 ignore start -- the Save button is disabled while the loop cannot be saved. */
    if (!canSave || !loop) return;
    /* v8 ignore stop */

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

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleSaveLoopConditions = async (conditions: LoopCondition[]) => {
    setLoopConditions(conditions);
    setIsConditionalLoop(conditions.length > 0);

    // Save automatically when conditions are configured
    /* v8 ignore start -- ConditionalLoop is only rendered while a loop exists. */
    if (!loop) return;
    /* v8 ignore stop */

    await updateLoop(loop.id, {
      loopConditions: conditions,
      isConditionalLoop: conditions.length > 0,
    });
    showSaveIndicator("loop conditions");
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
        <LoopHeader
          loopName={loop?.name}
          saveIndicator={saveIndicator}
          savingField={savingField}
          trialCount={loop?.trials?.length || 0}
        />

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

        <LoopBasicsSection
          randomize={randomize}
          repetitions={repetitions}
          saveField={saveField}
          setRandomize={setRandomize}
          setRepetitions={setRepetitions}
        />
        <LoopConditionsSection
          conditions={loopConditions}
          isConditional={isConditionalLoop}
          loop={loop}
          onSaveConditions={handleSaveLoopConditions}
          saveField={saveField}
          setConditions={setLoopConditions}
          setIsConditional={setIsConditionalLoop}
          setShowModal={setShowConditionalModal}
          showModal={showConditionalModal}
          showSaveIndicator={showSaveIndicator}
          updateLoop={updateLoop}
        />

        <LoopActions
          canSave={canSave}
          onDelete={handleRemoveLoop}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}

export default LoopsConfig;
