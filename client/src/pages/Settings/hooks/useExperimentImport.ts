import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { getApiBaseUrl } from "../../../lib/apiBaseUrl";
import type { SettingsNotification } from "../types";

export type ImportMode = "copy" | "restore";
export interface ImportPreview {
  importID: string;
  kind: "portable" | "backup";
  modes: ImportMode[];
  entries: {
    entryId: string;
    experimentID: string;
    name: string;
    existingName?: string;
    collision: boolean;
    warnings: string[];
    mediaCount: number;
    settingsState?: "complete" | "needs_review";
  }[];
}
const endpoint = `${getApiBaseUrl()}/api/import-experiments`;

export function useExperimentImport(
  setNotification: Dispatch<SetStateAction<SettingsNotification | null>>,
) {
  const importInputRef = useRef<HTMLInputElement>(null);
  const selectedFile = useRef<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(
    null,
  );
  const [importMode, setImportMode] = useState<ImportMode>("copy");
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importStale, setImportStale] = useState(false);
  const [importError, setImportError] = useState("");
  const reportError = (message: string) => {
    setImportError(message);
    setNotification({ type: "error", message });
  };
  const inspectFile = async (file: File) => {
    setIsImporting(true);
    setImportError("");
    try {
      const formData = new FormData();
      formData.append("zipfile", file);
      const response = await fetch(`${endpoint}/inspect`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (
        !response.ok ||
        !data.success ||
        !data.importID ||
        !data.entries?.length ||
        !data.modes?.includes("copy")
      ) {
        throw new Error(data.error || "Failed to import");
      }
      const previousID = importPreview?.importID;
      selectedFile.current = file;
      setImportPreview(data);
      setImportMode("copy");
      setReplaceExisting(false);
      setImportStale(false);
      if (previousID && previousID !== data.importID) {
        void fetch(`${endpoint}/${previousID}`, { method: "DELETE" }).catch(
          () => {},
        );
      }
    } catch (error) {
      reportError(error instanceof Error ? error.message : "Failed to import");
    } finally {
      setIsImporting(false);
    }
  };
  const handleImportZip = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file || isImporting) return;
    await inspectFile(file);
    input.value = "";
  };
  const confirmImport = async () => {
    if (!importPreview || isImporting || importStale) return;
    if (
      importMode === "restore" &&
      importPreview.entries.some((entry) => entry.collision) &&
      !replaceExisting
    )
      return;
    setIsImporting(true);
    setImportError("");
    try {
      const response = await fetch(
        `${endpoint}/${importPreview.importID}/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: importMode,
            replaceExisting: importMode === "restore" && replaceExisting,
          }),
        },
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        if (
          [
            "IMPORT_PREVIEW_STALE",
            "IMPORT_EXPIRED",
            "IMPORT_RECOVERY_REQUIRED",
            "IMPORT_RECOVERED",
            "IMPORT_ROLLED_BACK",
            "IMPORT_NOT_FOUND",
          ].includes(data.code) ||
          response.status === 410
        )
          setImportStale(true);
        throw new Error(data.error || "Failed to import");
      }
      setImportPreview(null);
      selectedFile.current = null;
      setNotification({
        type: "success",
        message:
          importMode === "copy"
            ? `${data.imported} experiment(s) imported as independent copies!`
            : `${data.imported} experiment(s) restored on this device!`,
      });
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      reportError(error instanceof Error ? error.message : "Failed to import");
    } finally {
      setIsImporting(false);
    }
  };
  const cancelImport = async () => {
    if (!importPreview || isImporting) return;
    setIsImporting(true);
    try {
      const response = await fetch(`${endpoint}/${importPreview.importID}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Could not cancel the import. Retry.");
      setImportPreview(null);
      selectedFile.current = null;
      setImportError("");
    } catch (error) {
      reportError(
        error instanceof Error
          ? error.message
          : "Could not cancel the import. Retry.",
      );
    } finally {
      setIsImporting(false);
    }
  };
  return {
    importInputRef,
    importPreview,
    importMode,
    replaceExisting,
    isImporting,
    importStale,
    importError,
    setImportMode: (mode: ImportMode) => {
      setImportMode(mode);
      setReplaceExisting(false);
    },
    setReplaceExisting,
    handleImportZip,
    confirmImport,
    cancelImport,
    inspectAgain: () => {
      if (selectedFile.current && !isImporting)
        void inspectFile(selectedFile.current);
    },
  };
}
