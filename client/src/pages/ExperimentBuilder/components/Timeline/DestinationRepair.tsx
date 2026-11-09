import { useState } from "react";
import {
  deploymentRequest,
  type DeploymentContext,
  type RepairPreview,
} from "../../../../lib/deploymentBindings";
type Props = {
  experimentID: string | undefined;
  context: DeploymentContext;
  onSaved: (context: DeploymentContext) => void;
};
export default function DestinationRepair({
  experimentID,
  context,
  onSaved,
}: Props) {
  const [preview, setPreview] = useState<RepairPreview | null>(null),
    [busy, setBusy] = useState(false),
    [accepted, setAccepted] = useState(false),
    [error, setError] = useState("");
  const [pendingRepair, setPendingRepair] = useState(context.pendingRepair);
  const [resource, setResource] = useState<"storage" | "github">(
      context.pendingRepair?.resource || "storage",
    ),
    [selection, setSelection] = useState(
      context.pendingRepair?.suggestedRepository ||
        context.pendingRepair?.suggestedFolder ||
        "",
    );
  async function inspect(selected: "storage" | "github", existing = false) {
    setBusy(true);
    setError("");
    setAccepted(false);
    setResource(selected);
    try {
      const result = await deploymentRequest(experimentID, "repair/inspect", {
        resource: selected,
        backendProjectId: context.projectId,
        selection: existing
          ? selected === "storage"
            ? { storageFolder: selection }
            : { repository: selection }
          : {},
      });
      if (!result.repairPreview)
        throw new Error("The backend did not return a repair preview.");
      setPreview(result.repairPreview);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not inspect the repair.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function repair() {
    if (!preview || !accepted) return;
    setBusy(true);
    setError("");
    try {
      onSaved(
        await deploymentRequest(experimentID, "repair/confirm", {
          resource: preview.resource,
          selection: preview.selection,
          contextFingerprint: preview.contextFingerprint,
          fingerprint: preview.fingerprint,
          confirmReplacement: true,
          acknowledgeDataLoss: true,
          backendProjectId: context.projectId,
        }),
      );
    } catch (e) {
      setPreview(null);
      setError(
        e instanceof Error ? e.message : "Could not repair the destination.",
      );
      try {
        const latest = await deploymentRequest(experimentID, "context");
        setPendingRepair(latest.pendingRepair);
        if (latest.pendingRepair) {
          setResource(latest.pendingRepair.resource);
          setSelection(
            latest.pendingRepair.suggestedRepository ||
              latest.pendingRepair.suggestedFolder ||
              "",
          );
        }
      } catch {
        /* Keep the original repair error visible. */
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Destination recovery">
      <h3>Cannot access a destination?</h3>
      <p>
        Check the linked account and its permissions, then retry verification.
        An inaccessible resource may still exist.
      </p>
      <p>
        <a href="#/settings">Reconnect accounts in Settings</a>
      </p>
      <div>
        {context.storage.state === "bound" && (
          <button disabled={busy} onClick={() => inspect("storage")}>
            Repair data folder
          </button>
        )}
        {context.github.state === "bound" && (
          <button disabled={busy} onClick={() => inspect("github")}>
            Repair GitHub repository
          </button>
        )}
      </div>
      {pendingRepair && (
        <label>
          Replacement created by an interrupted repair
          <input
            value={selection}
            disabled={busy}
            placeholder={
              resource === "storage"
                ? "Folder ID or Dropbox path"
                : "GitHub owner/repository"
            }
            onChange={(e) => setSelection(e.target.value)}
          />
          <button
            disabled={busy || !selection}
            onClick={() => inspect(pendingRepair!.resource, true)}
          >
            Inspect existing replacement
          </button>
        </label>
      )}
      {preview && (
        <div className="destination-summary">
          <h3>Confirm destination replacement</h3>
          <p>
            Account:{" "}
            <strong>{preview.accountLabel || preview.accountId}</strong>
          </p>
          <p>
            Previous destination:{" "}
            {preview.previous.folderId ||
              `${preview.previous.ownerLogin}/${preview.previous.repoName}`}
          </p>
          <p>
            {preview.replacement
              ? "The selected replacement will be verified and linked."
              : preview.resource === "storage"
                ? "A new data folder will be created in the linked account."
                : "A new repository will be created in the linked account. You must publish again; the public URL may change."}
          </p>
          {preview.replacement && (
            <p>
              Replacement ID:{" "}
              {preview.replacement.folderId || preview.replacement.repositoryId}
            </p>
          )}
          <p>
            The experiment ID, counters and historical references will be
            preserved. The previous resource will remain untouched.
          </p>
          {preview.resource === "storage" && (
            <p>
              Registered sessions keep their previous folder. New sessions will
              use the replacement.
            </p>
          )}
          {preview.resource === "github" && (
            <p>
              New repository visibility:{" "}
              {preview.previous.isPrivate === false ? "public" : "private"}.
            </p>
          )}
          <label className="destination-ack">
            <input
              type="checkbox"
              checked={accepted}
              disabled={busy}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            I understand that replacing this destination does not recover
            deleted files or move previous results.
          </label>
          <button disabled={busy || !accepted} onClick={repair}>
            {busy
              ? "Repairing…"
              : preview.replacement
                ? "Link verified replacement"
                : preview.resource === "storage"
                  ? "Create replacement folder"
                  : "Create replacement repository"}
          </button>
          <button disabled={busy} onClick={() => setPreview(null)}>
            Cancel repair
          </button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
