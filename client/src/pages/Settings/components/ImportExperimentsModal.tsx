import type { ImportMode, ImportPreview } from "../hooks/useExperimentImport";

interface Props {
  preview: ImportPreview;
  mode: ImportMode;
  replaceExisting: boolean;
  busy: boolean;
  stale: boolean;
  error: string;
  onModeChange: (mode: ImportMode) => void;
  onReplaceChange: (value: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onInspectAgain: () => void;
}

export function ImportExperimentsModal(props: Props) {
  const { preview, mode, replaceExisting, busy, stale } = props;
  const collision =
    mode === "restore" && preview.entries.some((entry) => entry.collision);
  return (
    <div className="backup-modal-overlay">
      <div
        className="backup-modal import-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        aria-busy={busy}
      >
        <h2 id="import-title" className="backup-modal-title">
          Import experiments
        </h2>
        <fieldset className="import-modes" disabled={busy}>
          <legend>How should these experiments be imported?</legend>
          <label>
            <input
              type="radio"
              name="import-mode"
              checked={mode === "copy"}
              onChange={() => props.onModeChange("copy")}
            />{" "}
            Create independent copies
          </label>
          {preview.modes.includes("restore") && (
            <label>
              <input
                type="radio"
                name="import-mode"
                checked={mode === "restore"}
                onChange={() => props.onModeChange("restore")}
              />{" "}
              Restore backup
            </label>
          )}
        </fieldset>
        <p className="backup-modal-subtitle">
          {mode === "copy"
            ? "Each copy gets a new identity, design and media. Local results and account connections are excluded. Review imported deployment settings before publishing."
            : "Keep the original experiment identities and restore the local design, media and results. Existing records are replaced, including empty histories. Published resources are unchanged; account connections must be verified again."}
        </p>
        <div className="backup-modal-list">
          {preview.entries.map((entry) => (
            <div className="import-entry" key={entry.entryId}>
              <strong>{entry.name}</strong>
              <span>{entry.mediaCount} media file(s)</span>
              {entry.settingsState === "needs_review" && (
                <span>
                  Complete functional settings are missing. Review and save them
                  before publishing.
                </span>
              )}
              {mode === "restore" && (
                <span className="import-entry-id">
                  ID: {entry.experimentID}
                </span>
              )}
              {mode === "restore" && entry.collision && (
                <span>
                  Replaces: {entry.existingName || entry.experimentID}
                </span>
              )}
              {entry.warnings.map((warning, index) => (
                <span key={index}>{warning}</span>
              ))}
            </div>
          ))}
        </div>
        {collision && (
          <label className="import-replace">
            <input
              type="checkbox"
              checked={replaceExisting}
              disabled={busy}
              onChange={(event) => props.onReplaceChange(event.target.checked)}
            />{" "}
            Replace the listed local experiments and their local results
          </label>
        )}
        {props.error && (
          <p role="alert" className="import-error">
            {props.error}
          </p>
        )}
        <div className="backup-modal-footer">
          <button
            className="backup-modal-cancel"
            disabled={busy}
            onClick={props.onCancel}
          >
            Cancel import
          </button>
          <div className="backup-modal-buttons">
            {stale && (
              <button
                className="backup-modal-cancel"
                disabled={busy}
                onClick={props.onInspectAgain}
              >
                Inspect again
              </button>
            )}
            <button
              className="backup-modal-export"
              disabled={busy || stale || (collision && !replaceExisting)}
              onClick={props.onConfirm}
            >
              {busy
                ? "Processing..."
                : mode === "copy"
                  ? "Create copies"
                  : "Restore backup"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
