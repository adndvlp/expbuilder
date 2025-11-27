// src/components/Timeline.tsx
import { useEffect, useState } from "react";
import { openExternal } from "../../../../lib/openExternal";
import { Trial } from "../ConfigPanel/types";
import useTrials from "../../hooks/useTrials";
import useUrl from "../../hooks/useUrl";
import useDevMode from "../../hooks/useDevMode";
import FileUploader from "./FileUploader";
import { useFileUpload } from "./useFileUpload";
import { StorageSelectModal } from "./StorageSelectModal";

import { useExperimentID } from "../../hooks/useExperimentID";
import { useExperimentCode } from "./useExperimentCode";

const API_URL = import.meta.env.VITE_API_URL;

function Timeline() {
  // Estado para tokens del usuario
  const [userTokens, setUserTokens] = useState<{
    drive: boolean;
    dropbox: boolean;
    github: boolean;
  } | null>(null);

  // Mostrar tooltip solo si el botón está deshabilitado por falta de tokens
  function isDisabledByTokens() {
    return !(
      userTokens &&
      userTokens.github &&
      (userTokens.drive || userTokens.dropbox)
    );
  }

  // Función para obtener tokens del usuario desde Firestore
  async function getUserTokens(
    uid: string
  ): Promise<{ drive: boolean; dropbox: boolean; github: boolean }> {
    try {
      // Importar Firestore dinámicamente para evitar dependencias innecesarias
      const { doc, getDoc } = await import("firebase/firestore");
      const { db } = await import("../../../../lib/firebase");
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists())
        return { drive: false, dropbox: false, github: false };
      const data = docSnap.data();
      return {
        drive: !!data.googleDriveTokens,
        dropbox: !!data.dropboxTokens,
        github: !!data.githubTokens,
      };
    } catch {
      return { drive: false, dropbox: false, github: false };
    }
  }

  // Cargar tokens al montar
  useEffect(() => {
    const userStr = window.localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user && user.uid) {
          getUserTokens(user.uid).then(setUserTokens);
        }
      } catch {}
    }
  }, []);
  const [submitStatus, setSubmitStatus] = useState<string>("");
  const { experimentUrl, setExperimentUrl } = useUrl();
  const [copyStatus, setCopyStatus] = useState<string>("");
  const [tunnelStatus, setTunnelStatus] = useState<string>("");
  const [isTunnelActive, setTunnelActive] = useState<boolean>(false);
  const [lastPagesUrl, setLastPagesUrl] = useState<string>("");
  const [publishStatus, setPublishStatus] = useState<string>("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [availableStorages, setAvailableStorages] = useState<string[]>([]);

  const experimentID = useExperimentID();

  const { trials } = useTrials();

  function isTrial(trial: any): trial is Trial {
    return "parameters" in trial;
  }

  const { isDevMode, code, setCode } = useDevMode();

  const [isSubmitting, setIsSubmitting] = useState(false);

  // For files in devmode
  const folder = "all";
  const accept = "audio/*,video/*,image/*";

  const { fileInputRef, uploadedFiles, handleFileUpload, handleDeleteFile } =
    useFileUpload({ folder });

  // Experiments hook
  const { generateLocalExperiment, generateExperiment } =
    useExperimentCode(uploadedFiles);

  const handleRunExperiment = async () => {
    setIsSubmitting(true);

    try {
      const generatedCode = isDevMode ? code : generateLocalExperiment();

      if (!isDevMode) {
        setSubmitStatus("Saving configuration...");
        const generatedCode = generateExperiment();

        setCode(generatedCode);

        const config = { generatedCode };

        // Paso 1: Guarda la configuración
        const response = await fetch(
          `${API_URL}/api/save-config/${experimentID}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(config),
            credentials: "include",
            mode: "cors",
          }
        );

        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }
        const result = await response.json();
        if (!result.success) {
          setSubmitStatus("Failed to save configuration.");
          setIsSubmitting(false);
          return;
        }

        setSubmitStatus("Saved Configuration! Building experiment...");
      }

      // Paso 2: Llama al build/run-experiment
      setSubmitStatus("Running experiment...");
      const runResponse = await fetch(
        `${API_URL}/api/run-experiment/${experimentID}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ generatedCode }),
          credentials: "include",
          mode: "cors",
        }
      );

      if (!runResponse.ok) {
        throw new Error(
          `Server responded with status: ${runResponse.status} when running experiment`
        );
      }

      const runResult = await runResponse.json();
      if (runResult.success) {
        // setExperimentUrl(result.urlExperiment);
        setSubmitStatus("Experiment ready!");
        // window.alert("Experiment ready!");
        setSubmitStatus("");

        // window.open(runResult.experimentUrl, "_blank"); // <--- ABRE AUTOMÁTICAMENTE
      } else {
        setSubmitStatus(
          "Saved configuration but failed at running the experiment."
        );
        window.alert(
          "Saved configuration but failed at running the experiment."
        );
      }
    } catch (error) {
      console.error("Error submitting configuration:", error);
      setSubmitStatus(
        `An error occurred: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsSubmitting(false);
      // console.log(generateExperiment());
    }
  };

  const handleShareLocalExperiment = async () => {
    const confirm = window.confirm(
      "Warning: All your local experiments will be public until you close the tunnel or exit the app. Anyone with a link can access them."
    );
    if (!confirm) return;
    try {
      const res = await fetch(`${API_URL}/api/create-tunnel`, {
        method: "POST",
      });

      const data = await res.json();
      if (data.success) {
        setExperimentUrl(`${data.url}/${experimentID}`);
        // Persist tunnel state in localStorage (global, not per experiment)
        localStorage.setItem("tunnelActive", "true");
        localStorage.setItem("tunnelUrl", data.url);
        const url = `${data.url}/${experimentID}`;
        try {
          await navigator.clipboard.writeText(url);
          setTunnelStatus("Public link copied to clipboard");
        } catch (err) {
          console.error("Failed to copy public link: ", err);
        }
        setTunnelActive(true);
        setTimeout(() => setTunnelStatus(""), 4000);
        return url;
      } else {
        console.error("Error creating tunnel:", data.error);
      }
    } catch (error) {
      console.error("Connection error:", error);
    }
  };

  const handleCloseTunnel = async () => {
    const confirm = window.confirm(
      "Stop sharing your local experiment? Participants won't be able to access it until you reopen the tunnel. Collected results will not be lost."
    );
    if (!confirm) return;
    try {
      const res = await fetch(`${API_URL}/api/close-tunnel`, {
        method: "POST",
      });
      const data = await res.json();

      setExperimentUrl(`${API_URL}/${experimentID}`);
      setTunnelActive(false);
      localStorage.removeItem("tunnelActive");
      localStorage.removeItem("tunnelUrl");
      if (data.success) {
        setTunnelStatus(data.message);
      } else {
        setTunnelStatus("Error closing tunnel");
        console.error(data.message);
      }
      setTimeout(() => setTunnelStatus(""), 2000);
    } catch (err) {
      console.error("Error closing tunnel:", err);
    }
  };
  // Restore tunnel state on mount (global, always show for current experiment)
  useEffect(() => {
    const tunnelActive = localStorage.getItem("tunnelActive") === "true";
    const tunnelUrl = localStorage.getItem("tunnelUrl");
    if (tunnelActive && tunnelUrl) {
      setTunnelActive(true);
      setExperimentUrl(`${tunnelUrl}/${experimentID}`);
    }
  }, [experimentID, setExperimentUrl]);

  const handleCopyLink = async () => {
    let linkToCopy = "";
    // Prioridad: el último link publicado (GitHub Pages) si existe
    if (lastPagesUrl) {
      linkToCopy = lastPagesUrl;
    } else if (isTunnelActive && experimentID) {
      const tunnelUrl = localStorage.getItem("tunnelUrl");
      if (tunnelUrl) {
        linkToCopy = `${tunnelUrl}/${experimentID}`;
      }
    }
    if (linkToCopy) {
      try {
        await navigator.clipboard.writeText(linkToCopy);
        setCopyStatus("Link copied!");
        setTimeout(() => setCopyStatus(""), 2000); // Clear message after 2 seconds
      } catch (err) {
        console.error("Failed to copy: ", err);
        setCopyStatus("Failed to copy link.");
      }
    } else {
      setCopyStatus("No published link available.");
      setTimeout(() => setCopyStatus(""), 2000);
    }
  };

  const handlePublishToGitHub = async () => {
    try {
      const userStr = window.localStorage.getItem("user");
      if (!userStr) {
        setPublishStatus("Error: User not logged in");
        return;
      }
      const user = JSON.parse(userStr);
      const uid = user.uid;

      // Obtener tokens del usuario
      const tokens = await getUserTokens(uid);

      // Determinar storage disponibles
      const storages: string[] = [];
      if (tokens.drive) storages.push("googledrive");
      if (tokens.dropbox) storages.push("dropbox");

      // Si no hay ningún storage conectado, mostrar error
      if (storages.length === 0) {
        setPublishStatus(
          "Error: Please connect Google Drive or Dropbox in Settings"
        );
        return;
      }

      setAvailableStorages(storages);

      // Si hay ambos storages, mostrar modal para seleccionar
      if (storages.length > 1) {
        setShowStorageModal(true);
      } else {
        // Si solo hay uno, publicar directamente
        await publishWithStorage(uid, storages[0]);
      }
    } catch (error) {
      console.error("Error preparing to publish:", error);
      setPublishStatus(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const publishWithStorage = async (uid: string, selectedStorage: string) => {
    setShowStorageModal(false);
    setIsPublishing(true);
    setPublishStatus("Publishing to GitHub...");

    try {
      const response = await fetch(
        `${API_URL}/api/publish-experiment/${experimentID}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid, storage: selectedStorage }),
          credentials: "include",
          mode: "cors",
        }
      );

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const result = await response.json();

      if (
        !result.success &&
        result.message?.includes("GitHub token not found or invalid")
      ) {
        setPublishStatus(
          "Warning: GitHub publish failed. Please reconnect your GitHub account in Settings."
        );
        return;
      }
      if (result.success) {
        setPublishStatus(`Published! GitHub Pages URL`);
        setLastPagesUrl(result.pagesUrl || "");
        try {
          await navigator.clipboard.writeText(result.pagesUrl);
          setTimeout(() => {
            setPublishStatus((prev) => prev + " copied to clipboard");
          }, 100);
        } catch (err) {
          console.error("Failed to copy GitHub Pages URL: ", err);
        }
      } else {
        setPublishStatus(`Error: ${result.message || "Failed to publish"}`);
      }
    } catch (error) {
      console.error("Error publishing to GitHub:", error);
      setPublishStatus(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsPublishing(false);
      setTimeout(() => setPublishStatus(""), 5000);
    }
  };

  const hasTrials = trials.filter(isTrial).length > 0;
  const hasLoops = trials.filter((item) => "trials" in item).length > 0;

  const allTrialsHaveCode =
    !hasTrials ||
    trials
      .filter(isTrial)
      .every((trial) => !!trial.trialCode && trial.trialCode.trim() !== "");

  const allLoopsHaveCode =
    !hasLoops ||
    trials
      .filter((item) => "trials" in item)
      .every((loop) => !!loop.code && loop.code.trim() !== "");

  const isDisabled =
    isSubmitting || ((!allTrialsHaveCode || !allLoopsHaveCode) && !isDevMode);

  return (
    <div className="timeline">
      <div style={{ marginBottom: 8, marginTop: 15 }}>
        <img className="logo-img" alt="Logo" />
      </div>

      <div>
        {submitStatus && (
          <div
            style={{
              marginTop: "12px",
              padding: "12px",
              borderRadius: "4px",
              backgroundColor: submitStatus.includes("success")
                ? "#d4edda"
                : submitStatus.includes("Failed") ||
                    submitStatus.includes("error")
                  ? "#f8d7da"
                  : "#cce5ff",
              color: submitStatus.includes("success")
                ? "#155724"
                : submitStatus.includes("Failed") ||
                    submitStatus.includes("error")
                  ? "#721c24"
                  : "#004085",
              textAlign: "center",
            }}
          >
            {submitStatus}
          </div>
        )}
        {/* Run Experiment Button */}

        <div style={{ marginTop: "16px" }}>
          <button
            className="run-experiment-btn"
            onClick={handleRunExperiment}
            disabled={isDisabled}
          >
            {isSubmitting
              ? "Processing..."
              : experimentUrl
                ? "Build Experiment"
                : "Build Experiment"}
          </button>
        </div>

        <div style={{ marginTop: 16 }}>
          <button
            type="button"
            style={{
              display: "block",
              width: "100%",
              padding: "10px 0",
              backgroundColor: "#4caf50",
              color: "#fff",
              textAlign: "center",
              textDecoration: "none",
              borderRadius: 6,
              fontWeight: "600",
              fontSize: 14,
              letterSpacing: "0.05em",
              transition: "background-color 0.3s ease",
              cursor: localStorage.getItem("tunnelUrl")
                ? "pointer"
                : experimentUrl
                  ? "pointer"
                  : "not-allowed",
              opacity: localStorage.getItem("tunnelUrl")
                ? 1
                : experimentUrl
                  ? 1
                  : 0.6,
            }}
            disabled={!(localStorage.getItem("tunnelUrl") || experimentUrl)}
            onClick={() => {
              const url = localStorage.getItem("tunnelUrl")
                ? `${localStorage.getItem("tunnelUrl")}/${experimentID}`
                : experimentUrl;
              if (url) openExternal(url);
            }}
            onMouseEnter={(e) => {
              const url = localStorage.getItem("tunnelUrl") || experimentUrl;
              if (url) e.currentTarget.style.backgroundColor = "#43a047";
            }}
            onMouseLeave={(e) => {
              const url = localStorage.getItem("tunnelUrl") || experimentUrl;
              if (url) e.currentTarget.style.backgroundColor = "#4caf50";
            }}
          >
            Run experiment
          </button>
          <button
            style={{
              display: "block",
              width: "100%",
              padding: "10px 0",
              backgroundColor: isTunnelActive ? "#cccccc" : "#604cafff",
              color: "#fff",
              textAlign: "center",
              textDecoration: "none",
              borderRadius: 6,
              fontWeight: "600",
              fontSize: 14,
              letterSpacing: "0.05em",
              marginTop: 12,
              transition: "background-color 0.3s ease",
              cursor: isTunnelActive ? "not-allowed" : "pointer",
              opacity: isTunnelActive ? 0.6 : 1,
            }}
            onClick={isTunnelActive ? undefined : handleShareLocalExperiment}
            disabled={isTunnelActive}
          >
            Share Local Experiment
          </button>
          {tunnelStatus && (
            <div style={{ marginTop: 6 }}>
              <p
                style={{
                  fontSize: 13,
                  color: "#4caf50",
                  textAlign: "center",
                  marginTop: 8,
                  fontWeight: "500",
                }}
              >
                {tunnelStatus}
              </p>
            </div>
          )}
          {isTunnelActive && (
            <button
              style={{ marginTop: 6, marginBottom: 6, width: "100%" }}
              onClick={handleCloseTunnel}
              className="remove-button"
            >
              Close tunnel
            </button>
          )}
        </div>

        {/* Publish to GitHub Button */}
        <div style={{ marginTop: "12px" }}>
          <button
            onClick={handleCopyLink}
            style={{
              display: "block",
              width: "100%",
              padding: "10px 0",
              backgroundColor: "#2196f3",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontWeight: "600",
              fontSize: 14,
              letterSpacing: "0.05em",
              cursor: "pointer",
              marginTop: 12,
              transition: "background-color 0.3s ease",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "#1e88e5")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "#2196f3")
            }
          >
            Copy Experiment Link
          </button>
          {copyStatus && (
            <p
              style={{
                fontSize: 13,
                color: copyStatus.includes("copied!") ? "#4caf50" : "#f44336",
                textAlign: "center",
                marginTop: 8,
                fontWeight: "500",
              }}
            >
              {copyStatus}
            </p>
          )}
          <div style={{ position: "relative" }}>
            <button
              onClick={handlePublishToGitHub}
              disabled={isPublishing || !experimentUrl || isDisabledByTokens()}
              style={{
                display: "block",
                width: "100%",
                padding: "10px 0",
                backgroundColor:
                  isPublishing || !experimentUrl || isDisabledByTokens()
                    ? "#cccccc"
                    : "#ff9800",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontWeight: "600",
                fontSize: 14,
                letterSpacing: "0.05em",
                marginTop: 12,
                cursor:
                  isPublishing || !experimentUrl || isDisabledByTokens()
                    ? "not-allowed"
                    : "pointer",
                transition: "background-color 0.3s ease",
              }}
            >
              {isPublishing ? "Publishing..." : "Publish to GitHub Pages"}
            </button>
          </div>
          {publishStatus && (
            <p
              style={{
                fontSize: 13,
                color: publishStatus.includes("Error") ? "#f44336" : "#4caf50",
                textAlign: "center",
                marginTop: 8,
                fontWeight: "500",
                wordBreak: "break-word",
              }}
            >
              {publishStatus}
            </p>
          )}
        </div>
      </div>
      <div
        style={{
          margin: "16px 0",
          padding: "12px",
          borderRadius: "8px",
          border: "none",
          color: "var(--text-dark)",
        }}
      >
        <FileUploader
          uploadedFiles={uploadedFiles}
          onFileUpload={handleFileUpload}
          onDeleteFile={handleDeleteFile}
          fileInputRef={fileInputRef}
          accept={accept}
        />
      </div>
      <StorageSelectModal
        isOpen={showStorageModal}
        availableStorages={availableStorages}
        onConfirm={async (storage) => {
          const userStr = window.localStorage.getItem("user");
          if (userStr) {
            const user = JSON.parse(userStr);
            await publishWithStorage(user.uid, storage);
          }
        }}
        onCancel={() => {
          setShowStorageModal(false);
          setIsPublishing(false);
        }}
      />
    </div>
  );
}

export default Timeline;
