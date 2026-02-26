import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../../../lib/firebase";
import { openExternal } from "../../../../lib/openExternal";
import useUrl from "../../hooks/useUrl";
import FileUploader from "./FileUploader";
import { StorageSelectModal } from "./StorageSelectModal";
import { useExperimentID } from "../../hooks/useExperimentID";
import { useExperimentCode } from "./ExperimentCode/useExperimentCode";
import PublishExperiment from "./PublishExperiment";
import Actions from "./Actions";

type UploadedFile = { name: string; url: string; type: string };

type TimelineProps = {
  uploadedFiles: UploadedFile[];
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  folderInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleDeleteFile: (file: UploadedFile) => Promise<void>;
  handleDeleteMultipleFiles?: (files: UploadedFile[]) => Promise<void>;
};

function Timeline({
  uploadedFiles,
  fileInputRef,
  folderInputRef,
  handleFileUpload,
  handleDeleteFile,
  handleDeleteMultipleFiles,
}: TimelineProps) {
  // Estado para tokens del usuario
  const [userTokens, setUserTokens] = useState<{
    drive: boolean;
    dropbox: boolean;
    osf: boolean;
    github: boolean;
  } | null>(null);

  // Mostrar tooltip solo si el botón está deshabilitado por falta de tokens
  function isDisabledByTokens() {
    return !(
      userTokens &&
      userTokens.github &&
      (userTokens.drive || userTokens.dropbox || userTokens.osf)
    );
  }

  // Función para obtener tokens del usuario desde Firestore (con cache en localStorage)
  async function getUserTokens(uid: string): Promise<{
    drive: boolean;
    dropbox: boolean;
    osf: boolean;
    github: boolean;
  }> {
    const CACHE_KEY = `userTokens_${uid}`;
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { tokens, ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) return tokens;
      }
    } catch {}
    try {
      const { doc, getDoc } = await import("firebase/firestore");
      const { db } = await import("../../../../lib/firebase");
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);
      const empty = { drive: false, dropbox: false, osf: false, github: false };
      if (!docSnap.exists()) {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ tokens: empty, ts: Date.now() }),
        );
        return empty;
      }
      const data = docSnap.data();
      const tokens = {
        drive: !!data.googleDriveTokens,
        dropbox: !!data.dropboxTokens,
        osf: !!data.osfTokens,
        github: !!data.githubTokens,
      };
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ tokens, ts: Date.now() }),
      );
      return tokens;
    } catch {
      return { drive: false, dropbox: false, osf: false, github: false };
    }
  }

  // Cargar tokens al montar usando onAuthStateChanged para mayor fiabilidad
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser?.uid) {
        getUserTokens(firebaseUser.uid).then(setUserTokens);
      } else {
        setUserTokens(null);
      }
    });
    return () => unsubscribe();
  }, []);
  const [submitStatus, setSubmitStatus] = useState<string>("");
  const { experimentUrl, setExperimentUrl } = useUrl();
  const [copyStatus, setCopyStatus] = useState<string>("");
  const [tunnelStatus, setTunnelStatus] = useState<string>("");
  const [isTunnelActive, setTunnelActive] = useState<boolean>(false);
  const [isTunnelCreating, setIsTunnelCreating] = useState<boolean>(false);
  const [activeTunnelUrl, setActiveTunnelUrl] = useState<string>("");
  const [lastPagesUrl, setLastPagesUrl] = useState<string>("");
  const [publishStatus, setPublishStatus] = useState<string>("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [availableStorages, setAvailableStorages] = useState<string[]>([]);

  const experimentID = useExperimentID();

  const [isSubmitting, setIsSubmitting] = useState(false);

  // For files in devmode
  const accept = "audio/*,video/*,image/*";

  const { generateLocalExperiment, generateExperiment, generatedBaseCode } =
    useExperimentCode(uploadedFiles);

  const { handleRunExperiment, handleShareLocalExperiment, handleCloseTunnel } =
    Actions({
      experimentID,
      lastPagesUrl,
      isTunnelActive,
      setIsSubmitting,
      generateLocalExperiment,
      generatedBaseCode,
      setSubmitStatus,
      setExperimentUrl,
      setCopyStatus,
      setTunnelStatus,
      setTunnelActive,
      setIsTunnelCreating,
      setActiveTunnelUrl,
      setLastPagesUrl,
    });

  const { handlePublishToGitHub, publishWithStorage } = PublishExperiment({
    experimentID,
    setLastPagesUrl,
    setPublishStatus,
    getUserTokens,
    setAvailableStorages,
    setShowStorageModal,
    setIsPublishing,
    generateExperiment, // Pasar la función para generar código público
  });

  // Ya no validamos códigos localmente - el backend maneja esto cuando se genera el experimento
  const isDisabled = isSubmitting;

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
              backgroundColor:
                isTunnelActive || isTunnelCreating ? "#cccccc" : "#604cafff",
              color: "#fff",
              textAlign: "center",
              textDecoration: "none",
              borderRadius: 6,
              fontWeight: "600",
              fontSize: 14,
              letterSpacing: "0.05em",
              marginTop: 12,
              transition: "background-color 0.3s ease",
              cursor:
                isTunnelActive || isTunnelCreating ? "not-allowed" : "pointer",
              opacity: isTunnelActive || isTunnelCreating ? 0.6 : 1,
            }}
            onClick={
              isTunnelActive || isTunnelCreating
                ? undefined
                : handleShareLocalExperiment
            }
            disabled={isTunnelActive || isTunnelCreating}
          >
            {isTunnelCreating ? "Creating tunnel..." : "Share Local Experiment"}
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

        {/* Copy links section */}
        <div style={{ marginTop: "12px" }}>
          {(activeTunnelUrl || lastPagesUrl) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {activeTunnelUrl && (
                <button
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "10px 0",
                    backgroundColor: "#604cafff",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    fontWeight: "600",
                    fontSize: 14,
                    letterSpacing: "0.05em",
                    cursor: "pointer",
                    transition: "background-color 0.3s ease",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "#4a3a9a")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "#604cafff")
                  }
                  onClick={async () => {
                    const url = `${activeTunnelUrl}/${experimentID}`;
                    try {
                      await navigator.clipboard.writeText(url);
                      setCopyStatus("Tunnel link copied!");
                      setTimeout(() => setCopyStatus(""), 2000);
                    } catch {
                      setCopyStatus("Failed to copy.");
                      setTimeout(() => setCopyStatus(""), 2000);
                    }
                  }}
                >
                  Copy Tunnel Link
                </button>
              )}
              {lastPagesUrl && (
                <button
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
                    marginTop: 4,
                    cursor: "pointer",
                    transition: "background-color 0.3s ease",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "#1e88e5")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "#2196f3")
                  }
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(lastPagesUrl);
                      setCopyStatus("GitHub Pages link copied!");
                      setTimeout(() => setCopyStatus(""), 2000);
                    } catch {
                      setCopyStatus("Failed to copy.");
                      setTimeout(() => setCopyStatus(""), 2000);
                    }
                  }}
                >
                  Copy GitHub Pages Link
                </button>
              )}
              {copyStatus && (
                <p
                  style={{
                    fontSize: 13,
                    color: copyStatus.includes("copied")
                      ? "#4caf50"
                      : "#f44336",
                    textAlign: "center",
                    marginTop: 4,
                    fontWeight: "500",
                  }}
                >
                  {copyStatus}
                </p>
              )}
            </div>
          )}
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
          onDeleteMultipleFiles={handleDeleteMultipleFiles}
          fileInputRef={fileInputRef}
          folderInputRef={folderInputRef}
          accept={accept}
        />
      </div>
      <StorageSelectModal
        isOpen={showStorageModal}
        availableStorages={availableStorages}
        onConfirm={async (storage) => {
          const firebaseUser = auth.currentUser;
          if (firebaseUser) {
            await publishWithStorage(firebaseUser.uid, storage);
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
