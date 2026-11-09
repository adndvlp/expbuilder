import { useState } from "react";
import { auth } from "../../../../lib/firebase";
import useUrl from "../../hooks/useUrl";
import { useExperimentID } from "../../hooks/useExperimentID";
import Actions from "./Actions";
import BuildControls from "./components/BuildControls";
import PublishControls from "./components/PublishControls";
import { useExperimentCode } from "./ExperimentCode/useExperimentCode";
import FileUploader from "./FileUploader";
import PublishExperiment from "./PublishExperiment";
import DestinationDialog from "./DestinationDialog";
import {
  deploymentRequest,
  type DeploymentContext,
} from "../../../../lib/deploymentBindings";
import { StorageSelectModal } from "./StorageSelectModal";
import { useUserTokens } from "./hooks/useUserTokens";

type UploadedFile = { name: string; url: string; type: string };

type TimelineProps = {
  uploadedFiles: UploadedFile[];
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  folderInputRef: React.RefObject<HTMLInputElement | null>;
  uploadStatus?: string;
  handleFileUpload: (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => Promise<void>;
  handleDeleteFile: (file: UploadedFile) => Promise<void>;
  handleDeleteMultipleFiles?: (files: UploadedFile[]) => Promise<void>;
};

function Timeline({
  uploadedFiles,
  fileInputRef,
  folderInputRef,
  uploadStatus,
  handleFileUpload,
  handleDeleteFile,
  handleDeleteMultipleFiles,
}: TimelineProps) {
  const { getUserTokens, isDisabledByTokens } = useUserTokens();
  const [submitStatus, setSubmitStatus] = useState("");
  const { experimentUrl, setExperimentUrl } = useUrl();
  const [tunnelCopyStatus, setTunnelCopyStatus] = useState("");
  const [pagesCopyStatus, setPagesCopyStatus] = useState("");
  const [tunnelStatus, setTunnelStatus] = useState("");
  const [isTunnelActive, setTunnelActive] = useState(false);
  const [isTunnelCreating, setIsTunnelCreating] = useState(false);
  const [activeTunnelUrl, setActiveTunnelUrl] = useState("");
  const [lastPagesUrl, setLastPagesUrl] = useState("");
  const [publishStatus, setPublishStatus] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [availableStorages, setAvailableStorages] = useState<string[]>([]);
  const [destinationContext, setDestinationContext] =
    useState<DeploymentContext | null>(null);
  const [isVerifyingDestinations, setIsVerifyingDestinations] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const experimentID = useExperimentID();
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
      setTunnelCopyStatus,
      setPagesCopyStatus,
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
    generateExperiment,
    onReviewDestinations: setDestinationContext,
  });

  return (
    <div className="timeline">
      <div style={{ marginBottom: 8, marginTop: 15 }}>
        <img className="logo-img" alt="Logo" />
      </div>
      <BuildControls
        submitStatus={submitStatus}
        isSubmitting={isSubmitting}
        experimentUrl={experimentUrl}
        experimentID={experimentID}
        tunnelStatus={tunnelStatus}
        isTunnelActive={isTunnelActive}
        isTunnelCreating={isTunnelCreating}
        onBuild={handleRunExperiment}
        onShare={handleShareLocalExperiment}
        onCloseTunnel={handleCloseTunnel}
      />
      <PublishControls
        activeTunnelUrl={activeTunnelUrl}
        lastPagesUrl={lastPagesUrl}
        experimentID={experimentID}
        experimentUrl={experimentUrl}
        tunnelCopyStatus={tunnelCopyStatus}
        pagesCopyStatus={pagesCopyStatus}
        publishStatus={publishStatus}
        isPublishing={isPublishing}
        disabledByTokens={isDisabledByTokens()}
        setTunnelCopyStatus={setTunnelCopyStatus}
        setPagesCopyStatus={setPagesCopyStatus}
        onPublish={handlePublishToGitHub}
      />
      <button
        disabled={isPublishing || isVerifyingDestinations}
        onClick={async () => {
          setIsVerifyingDestinations(true);
          try {
            setDestinationContext(
              await deploymentRequest(experimentID, "context"),
            );
          } catch (error) {
            setPublishStatus(
              `Error: ${error instanceof Error ? error.message : "Could not verify destinations."}`,
            );
          } finally {
            setIsVerifyingDestinations(false);
          }
        }}
      >
        {isVerifyingDestinations
          ? "Verifying destinations…"
          : "Publication destinations"}
      </button>
      {destinationContext && (
        <DestinationDialog
          experimentID={experimentID}
          context={destinationContext}
          onClose={() => setDestinationContext(null)}
          onSaved={(result) => {
            setDestinationContext(null);
            if (result.repairResult?.urlMayChange) setLastPagesUrl("");
            setPublishStatus(
              result.repairResult?.requiresPublication
                ? "Repository repaired. Publish again and use the new URL."
                : result.repairResult
                  ? "Data destination repaired. Previous results have not been moved or recovered."
                  : "Destinations saved. You can now publish.",
            );
          }}
        />
      )}
      <div
        style={{
          margin: "16px 0",
          padding: 12,
          borderRadius: 8,
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
          uploadStatus={uploadStatus}
          accept="audio/*,video/*,image/*"
        />
      </div>
      <StorageSelectModal
        isOpen={showStorageModal}
        availableStorages={availableStorages}
        onConfirm={async (storage) => {
          const firebaseUser = auth?.currentUser;
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
