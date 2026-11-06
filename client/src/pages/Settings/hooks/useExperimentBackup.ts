import { useState, type Dispatch, type SetStateAction } from "react";
import type { Experiment, SettingsNotification } from "../types";
import { getApiBaseUrl } from "../../../lib/apiBaseUrl";
import { useExperimentImport } from "./useExperimentImport";

const API_URL = getApiBaseUrl();

interface BackupOptions {
  experiments: Experiment[];
  setNotification: Dispatch<SetStateAction<SettingsNotification | null>>;
}

interface ZipSaveResult {
  success: boolean;
  error?: string;
}

function errorMessage(error: unknown, fallback: string) {
  return (error as { message?: string }).message || fallback;
}

export function useExperimentBackup({
  experiments,
  setNotification,
}: BackupOptions) {
  const importer = useExperimentImport(setNotification);
  const [exportKind, setExportKind] = useState<"backup" | "portable">("backup");
  const kindQuery = exportKind === "portable" ? "?kind=portable" : "";
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedExperimentIds, setSelectedExperimentIds] = useState<
    Set<string>
  >(new Set());
  const [isExporting, setIsExporting] = useState(false);

  const saveZipFromResponse = async (response: Response, filename: string) => {
    const arrayBuffer = await response.arrayBuffer();
    const electronWindow = window as unknown as {
      electron: {
        saveZipFile: (
          bytes: number[],
          filename: string,
        ) => Promise<ZipSaveResult>;
      };
    };
    return electronWindow.electron.saveZipFile(
      Array.from(new Uint8Array(arrayBuffer)),
      filename,
    );
  };

  const handleExportAll = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(
        `${API_URL}/api/export-all-experiments${kindQuery}`,
      );
      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(error.error || "Error exporting experiments");
      }
      const date = new Date().toISOString().slice(0, 10);
      const result = await saveZipFromResponse(
        response,
        `experiments-${exportKind}-${date}.zip`,
      );
      if (result.success) {
        setNotification({
          type: "success",
          message: "All experiments exported!",
        });
      } else if (result.error !== "Cancelled") {
        setNotification({
          type: "error",
          message: result.error || "Export failed",
        });
      }
    } catch (error: unknown) {
      setNotification({
        type: "error",
        message: errorMessage(error, "Export failed"),
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSelected = async () => {
    /* v8 ignore start */
    if (selectedExperimentIds.size === 0) return;
    /* v8 ignore stop */
    setIsExporting(true);
    try {
      if (selectedExperimentIds.size === 1) {
        const [experimentId] = [...selectedExperimentIds];
        const experiment = experiments.find(
          (item) => item.experimentID === experimentId,
        );
        const response = await fetch(
          `${API_URL}/api/export-experiment/${experimentId}${kindQuery}`,
        );
        if (!response.ok) throw new Error("Export failed");
        const safeName = (experiment?.name || experimentId).replace(
          /[^a-zA-Z0-9\-_]/g,
          "_",
        );
        const result = await saveZipFromResponse(
          response,
          `${safeName}-${exportKind}.zip`,
        );
        if (result.success) {
          setNotification({
            type: "success",
            message: "Experiment exported!",
          });
        } else if (result.error !== "Cancelled") {
          setNotification({
            type: "error",
            message: result.error || "Export failed",
          });
        }
      } else {
        const ids = [...selectedExperimentIds].join(",");
        const response = await fetch(
          `${API_URL}/api/export-all-experiments?ids=${encodeURIComponent(ids)}${exportKind === "portable" ? "&kind=portable" : ""}`,
        );
        if (!response.ok) throw new Error("Export failed");
        const date = new Date().toISOString().slice(0, 10);
        const result = await saveZipFromResponse(
          response,
          `experiments-${exportKind}-${date}.zip`,
        );
        if (result.success) {
          setNotification({
            type: "success",
            message: `${selectedExperimentIds.size} experiments exported!`,
          });
        } else if (result.error !== "Cancelled") {
          setNotification({
            type: "error",
            message: result.error || "Export failed",
          });
        }
      }
    } catch (error: unknown) {
      setNotification({
        type: "error",
        message: errorMessage(error, "Export failed"),
      });
    } finally {
      setIsExporting(false);
      setShowExportModal(false);
      setSelectedExperimentIds(new Set());
    }
  };

  return {
    ...importer,
    exportKind,
    setExportKind,
    showExportModal,
    selectedExperimentIds,
    setSelectedExperimentIds,
    isExporting,
    handleExportAll,
    handleExportSelected,
    openExportModal: () => {
      setSelectedExperimentIds(new Set());
      setShowExportModal(true);
    },
    closeExportModal: () => {
      setShowExportModal(false);
      setSelectedExperimentIds(new Set());
    },
  };
}
