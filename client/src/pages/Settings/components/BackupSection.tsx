import type { RefObject } from "react";
import type { Experiment } from "../types";

interface BackupSectionProps {
  experiments: Experiment[];
  importInputRef: RefObject<HTMLInputElement | null>;
  isExporting: boolean;
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onExportAll: () => void;
  onOpenExportModal: () => void;
}

export function BackupSection({
  experiments,
  importInputRef,
  isExporting,
  onImport,
  onExportAll,
  onOpenExportModal,
}: BackupSectionProps) {
  return (
    <div className="settings-section">
      <h2 className="settings-section-title">Backup &amp; Restore</h2>
      <input
        type="file"
        accept="application/zip,.zip"
        style={{ display: "none" }}
        ref={importInputRef}
        onChange={onImport}
      />
      <div className="backup-grid">
        <div className="backup-card backup-card-import">
          <div className="backup-card-icon">
            <ImportIcon />
          </div>
          <span className="backup-card-label">Import Backup</span>
          <span className="backup-card-desc">
            Restore experiments from a .zip backup. Existing experiments with
            the same ID will be updated.
          </span>
          <div className="backup-card-actions">
            <button
              className="backup-btn backup-btn-primary"
              onClick={() => importInputRef.current?.click()}
            >
              <ImportIcon size={15} />
              Choose .zip file
            </button>
          </div>
        </div>

        <div className="backup-card backup-card-export">
          <div className="backup-card-icon">
            <ExportIcon />
          </div>
          <span className="backup-card-label">Export Experiments</span>
          <span className="backup-card-desc">
            Save experiments as a .zip — one folder per experiment with
            data.json and media files (img/, aud/, vid/).
            {experiments.length > 0 && (
              <>
                {" "}
                <strong style={{ color: "#e57373" }}>
                  {experiments.length} experiment
                  {experiments.length !== 1 ? "s" : ""} available.
                </strong>
              </>
            )}
          </span>
          <div className="backup-card-actions">
            <button
              className="backup-btn backup-btn-danger"
              onClick={onExportAll}
              disabled={isExporting || experiments.length === 0}
            >
              <ExportIcon size={15} />
              {isExporting ? "Exporting..." : "Export all"}
            </button>
            <button
              className="backup-btn backup-btn-secondary"
              onClick={onOpenExportModal}
              disabled={experiments.length === 0}
            >
              Export selected...
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ImportIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M12 3a1 1 0 0 1 1 1v11.586l3.293-3.293a1 1 0 0 1 1.414 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 1 1 1.414-1.414L11 15.586V4a1 1 0 0 1 1-1Z"
      />
      <path fill="currentColor" d="M4 19a1 1 0 1 0 0 2h16a1 1 0 1 0 0-2H4Z" />
    </svg>
  );
}

function ExportIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M12 2a1 1 0 0 0-1 1v11.586L7.707 11.293a1 1 0 0 0-1.414 1.414l5 5a1 1 0 0 0 1.414 0l5-5a1 1 0 0 0-1.414-1.414L13 14.586V3a1 1 0 0 0-1-1Z"
        transform="rotate(180 12 12)"
      />
      <path fill="currentColor" d="M4 19a1 1 0 1 0 0 2h16a1 1 0 1 0 0-2H4Z" />
    </svg>
  );
}
