import { Dispatch, SetStateAction } from "react";
import { auth } from "../../../../lib/firebase";
const API_URL = import.meta.env.VITE_API_URL;

type PublishErrorFile = {
  url?: string;
  filename?: string;
  sizeBytes?: number;
};

type PublishResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  code?: string;
  repoUrl?: string;
  pagesUrl?: string;
  oversizedFiles?: PublishErrorFile[];
};

function formatSizeMiB(sizeBytes?: number) {
  if (!sizeBytes) return "";
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function buildPublishErrorMessage(
  result: PublishResponse | null,
  status: number,
) {
  if (result?.code === "GITHUB_FILE_TOO_LARGE") {
    if (result.message || result.error) return result.message || result.error;

    const files =
      result.oversizedFiles
        ?.map((file) =>
          [file.url || file.filename, formatSizeMiB(file.sizeBytes)]
            .filter(Boolean)
            .join(" "),
        )
        .join(", ") || "one or more media files";
    return `GitHub no acepta archivos mayores a 100 MiB: ${files}. Comprime o reemplaza estos archivos antes de publicar.`;
  }

  return (
    result?.message ||
    result?.error ||
    `Server responded with status: ${status}`
  );
}

async function readPublishResponse(response: Response) {
  try {
    return (await response.json()) as PublishResponse;
  } catch {
    return null;
  }
}

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
  generateExperiment: (storage?: string) => Promise<string>; // Función para generar código público
};

export default function PublishExperiment({
  experimentID,
  setLastPagesUrl,
  setPublishStatus,
  getUserTokens,
  setAvailableStorages,
  setShowStorageModal,
  setIsPublishing,
  generateExperiment,
}: Props) {
  const handlePublishToGitHub = async () => {
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        setPublishStatus("Error: User not logged in");
        return;
      }
      const uid = firebaseUser.uid;

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
    setPublishStatus("Generating public code...");
    let keepPublishStatus = false;

    try {
      // Generar código público para GitHub Pages con el storage seleccionado
      const generatedPublicCode = await generateExperiment(selectedStorage);

      if (!generatedPublicCode) {
        throw new Error("Failed to generate public experiment code");
      }

      setPublishStatus("Publishing to GitHub...");

      const response = await fetch(
        `${API_URL}/api/publish-experiment/${experimentID}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid,
            storage: selectedStorage,
            generatedPublicCode, // Enviar el código público generado
          }),
          credentials: "include",
          mode: "cors",
        },
      );

      const result = await readPublishResponse(response);

      if (!response.ok) {
        keepPublishStatus = result?.code === "GITHUB_FILE_TOO_LARGE";
        throw new Error(buildPublishErrorMessage(result, response.status));
      }

      if (
        !result?.success &&
        result?.message?.includes("GitHub token not found or invalid")
      ) {
        setPublishStatus(
          "Warning: GitHub publish failed. Please reconnect your GitHub account in Settings.",
        );
        return;
      }
      if (result?.success) {
        const pagesUrl = result.pagesUrl || "";
        setPublishStatus(`Published! GitHub Pages URL`);
        setLastPagesUrl(pagesUrl);
        try {
          await navigator.clipboard.writeText(pagesUrl);
          setTimeout(() => {
            setPublishStatus((prev) => prev + " copied to clipboard");
          }, 100);
        } catch (err) {
          console.error("Failed to copy GitHub Pages URL: ", err);
        }
      } else {
        setPublishStatus(
          `Error: ${result?.message || result?.error || "Failed to publish"}`,
        );
      }
    } catch (error) {
      console.error("Error publishing to GitHub:", error);
      setPublishStatus(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsPublishing(false);
      if (!keepPublishStatus) {
        setTimeout(() => setPublishStatus(""), 5000);
      }
    }
  };
  return { handlePublishToGitHub, publishWithStorage };
}
