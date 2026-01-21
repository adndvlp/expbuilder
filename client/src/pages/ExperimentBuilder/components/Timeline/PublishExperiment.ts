import { Dispatch, SetStateAction } from "react";
const API_URL = import.meta.env.VITE_API_URL;

type Props = {
  experimentID: string | undefined;
  setLastPagesUrl: Dispatch<SetStateAction<string>>;
  setPublishStatus: Dispatch<SetStateAction<string>>;
  getUserTokens(uid: string): Promise<{
    drive: boolean;
    dropbox: boolean;
    osf: boolean;
    github: boolean;
  }>;
  setAvailableStorages: Dispatch<SetStateAction<string[]>>;
  setShowStorageModal: Dispatch<SetStateAction<boolean>>;
  setIsPublishing: Dispatch<SetStateAction<boolean>>;
};

export default function PublishExperiment({
  experimentID,
  setLastPagesUrl,
  setPublishStatus,
  getUserTokens,
  setAvailableStorages,
  setShowStorageModal,
  setIsPublishing,
}: Props) {
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
      if (tokens.osf) storages.push("osf");

      // Si no hay ningún storage conectado, mostrar error
      if (storages.length === 0) {
        setPublishStatus(
          "Error: Please connect Google Drive, Dropbox, or OSF in Settings",
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
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
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
        },
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
          "Warning: GitHub publish failed. Please reconnect your GitHub account in Settings.",
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
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsPublishing(false);
      setTimeout(() => setPublishStatus(""), 5000);
    }
  };
  return { handlePublishToGitHub, publishWithStorage };
}
