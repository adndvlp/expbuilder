import { Dispatch, SetStateAction } from "react";
import { auth } from "../../../../lib/firebase";
import { getApiBaseUrl } from "../../../../lib/apiBaseUrl";
import {
  requireFunctionalSettings,
  type FunctionalSettings,
} from "../../../../lib/functionalSettings";
const API_URL = getApiBaseUrl();

import {
  buildPublishErrorMessage,
  readPublishResponse,
} from "./publishResponse";
import {
  deploymentRequest,
  needsDestinationReview,
  publicationStorage,
  BindingRequestError,
  type DeploymentContext,
} from "../../../../lib/deploymentBindings";

type Props = {
  onReviewDestinations?: (context: DeploymentContext) => void;
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
  generateExperiment: (
    storage?: string,
    settingsSnapshot?: FunctionalSettings,
  ) => Promise<string>;
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
  onReviewDestinations,
}: Props) {
  const handlePublishToGitHub = async () => {
    try {
      const firebaseUser = auth?.currentUser;
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

      const context = await deploymentRequest(experimentID, "context");
      if (needsDestinationReview(context)) {
        onReviewDestinations?.(context);
        setPublishStatus(
          context.pendingRepair
            ? "Resume the pending destination repair before publishing."
            : "Verify the original destinations from Publication destinations before publishing.",
        );
        return;
      }
      const linked = publicationStorage(context);
      if (linked) {
        if (!storages.includes(linked))
          throw new Error(
            "Reconnect the linked data provider in Settings before publishing.",
          );
        await publishWithStorage(uid, linked);
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
      const firebaseUser = auth?.currentUser;
      if (!firebaseUser || firebaseUser.uid !== uid) {
        throw new Error("User not logged in");
      }
      const idToken = await firebaseUser.getIdToken();
      const functionalSettings = await requireFunctionalSettings(experimentID);
      const context = await deploymentRequest(experimentID, "context");
      publicationStorage(context, selectedStorage);

      // Generar código público para GitHub Pages con el storage seleccionado
      const generatedPublicCode = await generateExperiment(
        selectedStorage,
        functionalSettings,
      );

      if (!generatedPublicCode) {
        throw new Error("Failed to generate public experiment code");
      }

      const current = await deploymentRequest(experimentID, "context");
      if (JSON.stringify(current) !== JSON.stringify(context))
        throw new BindingRequestError(
          "The backend or publication destinations changed. Generate and publish again.",
          "BACKEND_CONTEXT_CHANGED",
        );
      if (auth?.currentUser?.uid !== uid)
        throw new BindingRequestError(
          "The signed in account changed. Publish again.",
          "AUTH_REQUIRED",
        );
      setPublishStatus("Publishing to GitHub...");

      const response = await fetch(
        `${API_URL}/api/publish-experiment/${experimentID}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uid,
            storage: selectedStorage,
            backendProjectId: context.projectId,
            generatedPublicCode, // Enviar el código público generado
            functionalSettings,
          }),
          credentials: "include",
          mode: "cors",
        },
      );

      const result = await readPublishResponse(response);

      if (!response.ok) {
        keepPublishStatus =
          result?.code === "GITHUB_FILE_TOO_LARGE" ||
          Boolean(
            result?.code?.includes("BINDING") ||
              result?.code?.includes("MIGRATION") ||
              result?.code?.includes("REPAIR"),
          );
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
      keepPublishStatus =
        keepPublishStatus || error instanceof BindingRequestError;
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
