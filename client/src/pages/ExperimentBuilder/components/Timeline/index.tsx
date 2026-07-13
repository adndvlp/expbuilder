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
