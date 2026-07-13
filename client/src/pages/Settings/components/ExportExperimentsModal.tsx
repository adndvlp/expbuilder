import type { Dispatch, SetStateAction } from "react";
import type { Experiment } from "../types";

interface ExportExperimentsModalProps {
  experiments: Experiment[];
  selectedExperimentIds: Set<string>;
  isExporting: boolean;
  onSelectionChange: Dispatch<SetStateAction<Set<string>>>;
  onClose: () => void;
  onExport: () => void;
}

export function ExportExperimentsModal({
  experiments,
  selectedExperimentIds,
  isExporting,
  onSelectionChange,
  onClose,
  onExport,
}: ExportExperimentsModalProps) {
  return (
    <div className="backup-modal-overlay" onClick={onClose}>
      <div
        className="backup-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="backup-modal-title">Export experiments</p>
        <p className="backup-modal-subtitle">
          Each experiment exports as a folder with data.json + media files
        </p>
        <div className="backup-modal-list">
          <label className="backup-modal-select-all">
            <input
              type="checkbox"
              checked={
                experiments.length > 0 &&
                selectedExperimentIds.size === experiments.length
              }
              onChange={(event) =>
                onSelectionChange(
                  event.target.checked
                    ? new Set(experiments.map((item) => item.experimentID))
                    : new Set(),
                )
              }
            />
            Select all ({experiments.length})
          </label>
          {experiments.map((experiment) => (
            <label key={experiment.experimentID} className="backup-modal-item">
              <input
                type="checkbox"
                checked={selectedExperimentIds.has(experiment.experimentID)}
                onChange={(event) => {
                  const next = new Set(selectedExperimentIds);
                  if (event.target.checked) next.add(experiment.experimentID);
                  else next.delete(experiment.experimentID);
                  onSelectionChange(next);
                }}
              />
              {experiment.name || experiment.experimentID}
            </label>
          ))}
        </div>
        <div className="backup-modal-footer">
          <span className="backup-modal-count">
            {selectedExperimentIds.size} of {experiments.length} selected
          </span>
          <div className="backup-modal-buttons">
            <button className="backup-modal-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              className="backup-modal-export"
              onClick={onExport}
              disabled={selectedExperimentIds.size === 0 || isExporting}
            >
              {isExporting
                ? "Exporting..."
                : `Export (${selectedExperimentIds.size})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
