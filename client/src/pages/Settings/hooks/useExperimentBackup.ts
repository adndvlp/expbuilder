import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Experiment, SettingsNotification } from "../types";
import { getApiBaseUrl } from "../../../lib/apiBaseUrl";

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
  const importInputRef = useRef<HTMLInputElement>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedExperimentIds, setSelectedExperimentIds] = useState<
    Set<string>
  >(new Set());
  const [isExporting, setIsExporting] = useState(false);

  const saveExportedZip = async (apiPath: string, filename: string) => {
    const electronWindow = window as unknown as {
      electron: {
        saveExportedZip: (
          apiPath: string,
          filename: string,
        ) => Promise<ZipSaveResult>;
      };
    };
    return electronWindow.electron.saveExportedZip(apiPath, filename);
  };

  const handleExportAll = async () => {
    setIsExporting(true);
    try {
      const date = new Date().toISOString().slice(0, 10);
      const result = await saveExportedZip(
        "/api/export-all-experiments",
        `experiments-backup-${date}.zip`,
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
      let apiPath: string;
      let filename: string;
      let successMessage: string;
      if (selectedExperimentIds.size === 1) {
        const [experimentId] = [...selectedExperimentIds];
        const experiment = experiments.find(
          (item) => item.experimentID === experimentId,
        );
        const safeName = (experiment?.name || experimentId).replace(
          /[^a-zA-Z0-9\-_]/g,
          "_",
        );
        apiPath = `/api/export-experiment/${encodeURIComponent(experimentId)}`;
        filename = `${safeName}-backup.zip`;
        successMessage = "Experiment exported!";
      } else {
        const ids = [...selectedExperimentIds].join(",");
        apiPath = `/api/export-all-experiments?ids=${encodeURIComponent(ids)}`;
        filename = `experiments-backup-${new Date().toISOString().slice(0, 10)}.zip`;
        successMessage = `${selectedExperimentIds.size} experiments exported!`;
      }
      const result = await saveExportedZip(apiPath, filename);
      if (result.success) {
        setNotification({
          type: "success",
          message: successMessage,
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
      setShowExportModal(false);
      setSelectedExperimentIds(new Set());
    }
  };

  const handleImportZip = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("zipfile", file);
    try {
      const response = await fetch(`${API_URL}/api/import-experiments`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (data.success) {
        setNotification({
          type: "success",
          message: `${data.imported} experiment(s) imported successfully!`,
        });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setNotification({
          type: "error",
          message: data.error || "Failed to import",
        });
      }
    } catch {
      setNotification({ type: "error", message: "Failed to import" });
    }
    event.target.value = "";
  };

  return {
    importInputRef,
    showExportModal,
    selectedExperimentIds,
    setSelectedExperimentIds,
    isExporting,
    handleExportAll,
    handleExportSelected,
    handleImportZip,
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
