import { useEffect, useRef, useState } from "react";
import {
  deploymentRequest,
  type DeploymentContext,
  type BindingPreview,
} from "../../../../lib/deploymentBindings";
import "./DestinationDialog.css";
import DestinationRepair from "./DestinationRepair";
type Props = {
  experimentID: string | undefined;
  context: DeploymentContext;
  onClose: () => void;
  onSaved: (context: DeploymentContext) => void;
};
export default function DestinationDialog({
  experimentID,
  context,
  onClose,
  onSaved,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [repository, setRepository] = useState(
    context.github.binding
      ? `${context.github.binding.ownerLogin}/${context.github.binding.repoName}`
      : context.github.suggestedRepository || "",
  );
  const [storageFolder, setStorageFolder] = useState("");
  const [preview, setPreview] = useState<BindingPreview | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const node = dialog.current;
    if (node && !node.open) {
      if (node.showModal) node.showModal();
      else node.setAttribute("open", "");
    }
    return () => node?.close?.();
  }, []);
  const fresh =
    context.storage.state === "new" && context.github.state === "new";
  async function inspect() {
    setBusy(true);
    setError("");
    setPreview(null);
    try {
      const result = await deploymentRequest(experimentID, "inspect", {
        backendProjectId: context.projectId,
        selection: {
          ...(repository && { repository }),
          ...(storageFolder && { storageFolder }),
        },
      });
      if (!result.preview)
        throw new Error("The backend did not return a verified preview.");
      setPreview(result.preview);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not inspect destinations.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!preview) return;
    setBusy(true);
    setError("");
    try {
      onSaved(
        await deploymentRequest(experimentID, "confirm", {
          backendProjectId: context.projectId,
          selection: preview.selection,
          contextFingerprint: preview.contextFingerprint,
          fingerprint: preview.fingerprint,
        }),
      );
    } catch (e) {
      setPreview(null);
      setError(e instanceof Error ? e.message : "Could not save destinations.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="destination-dialog"
      aria-labelledby="destination-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <h2 id="destination-title">Publication destinations</h2>
      {fresh ? (
        <p>
          The first publication will create a data folder and a GitHub
          repository for this experiment. You can choose among your connected
          data providers when publishing.
        </p>
      ) : (
        <>
          <p>
            Verify the original destinations before saving. Publishing and
            deleting cloud resources will use these linked identities.
          </p>
          <p>
            Data provider:{" "}
            <strong>
              {
                { googledrive: "Google Drive", dropbox: "Dropbox", osf: "OSF" }[
                  context.storage.provider || "googledrive"
                ]
              }
            </strong>
          </p>
          {context.storage.binding && (
            <p>
              Linked data account:{" "}
              {context.storage.binding.accountLabel ||
                context.storage.binding.accountId}
            </p>
          )}
          {context.github.binding && (
            <p>
              Linked GitHub account:{" "}
              {context.github.binding.accountLogin ||
                context.github.binding.accountId}
            </p>
          )}
          {!preview && (
            <>
              <label>
                Original GitHub repository
                <input
                  aria-label="Original GitHub repository"
                  value={repository}
                  onChange={(e) => setRepository(e.target.value)}
                  disabled={busy}
                  placeholder="https://github.com/owner/repository"
                />
              </label>
              {context.storage.state === "needs_confirmation" && (
                <label>
                  Original data folder ID or Dropbox path (optional)
                  <input
                    value={storageFolder}
                    onChange={(e) => setStorageFolder(e.target.value)}
                    disabled={busy}
                  />
                  <small>
                    Leave empty to verify the folder already recorded for this
                    experiment.
                  </small>
                </label>
              )}
              <button onClick={inspect} disabled={busy}>
                {busy ? "Inspecting…" : "Inspect destinations"}
              </button>
            </>
          )}
          {preview && (
            <>
              <div className="destination-summary">
                <h3>Data folder</h3>
                <p>{preview.storage.folderName}</p>
                <p>
                  Account:{" "}
                  {preview.storage.accountLabel || preview.storage.accountId}
                </p>
                <p>Folder ID: {preview.storage.folderId}</p>
                {preview.storage.folderPath && (
                  <p>{preview.storage.folderPath}</p>
                )}
                <h3>GitHub repository</h3>
                {preview.github ? (
                  <>
                    <p>
                      {preview.github.ownerLogin}/{preview.github.repoName}
                    </p>
                    <p>Repository ID: {preview.github.repositoryId}</p>
                    <p>
                      Account ID: {preview.github.accountId} · Branch:{" "}
                      {preview.github.branch}
                    </p>
                  </>
                ) : (
                  <p>A new repository will be created at first publication.</p>
                )}
              </div>
              <p>
                Saving adds the experiment identity marker. The next publication
                will update index.html and media in img/, vid/ and aud/. Saving
                does not publish the experiment.
              </p>
              <button onClick={save} disabled={busy}>
                {busy ? "Saving…" : "Save destinations"}
              </button>
              <button onClick={() => setPreview(null)} disabled={busy}>
                Back
              </button>
            </>
          )}
        </>
      )}
      {!fresh && (
        <DestinationRepair
          experimentID={experimentID}
          context={context}
          onSaved={onSaved}
        />
      )}
      {error && <p role="alert">{error}</p>}
      <button onClick={onClose} disabled={busy}>
        Close
      </button>
    </dialog>
  );
}
