import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import { FaFilter } from "react-icons/fa";
import { Filters, TabType } from "../types";
import { getResultsTitle } from "../services/sessionFiltering";
import SessionFilterDropdown from "./SessionFilterDropdown";

type Props = {
  activeTab: TabType;
  sessionsCount: number;
  filteredCount: number;
  selectMode: boolean;
  setSelectMode: Dispatch<SetStateAction<boolean>>;
  selectedCount: number;
  onlineLoading: boolean;
  filters: Filters;
  setFilters: Dispatch<SetStateAction<Filters>>;
  browsers: string[];
  operatingSystems: string[];
  resolutions: string[];
  hasActiveFilters: boolean;
  onRefresh: () => void;
  onCancelSelect: () => void;
  onDownloadSelected: () => void;
  onDownloadSelectedOnline: () => void;
  onDeleteSelected: () => void;
};

const goldButtonStyle = {
  borderRadius: 6,
  fontSize: 12,
  background: "linear-gradient(135deg, var(--gold), var(--dark-gold))",
};

export default function ResultsToolbar(props: Props) {
  const {
    activeTab,
    sessionsCount,
    filteredCount,
    selectMode,
    setSelectMode,
    selectedCount,
    onlineLoading,
    filters,
    hasActiveFilters,
    onRefresh,
    onCancelSelect,
    onDownloadSelected,
    onDownloadSelectedOnline,
    onDeleteSelected,
  } = props;
  const [filterOpen, setFilterOpen] = useState(false);
  const filterButtonRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!filterOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        dropdownRef.current?.contains(event.target as Node) ||
        filterButtonRef.current?.contains(event.target as Node)
      ) {
        return;
      }
      setFilterOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [filterOpen]);

  const supportsSelection = activeTab === "local" || activeTab === "online";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 4,
      }}
    >
      <h4 className="results-title" style={{ margin: 0 }}>
        {getResultsTitle(activeTab)}
      </h4>
      {activeTab === "online" && (
        <button
          className="download-csv-btn"
          style={goldButtonStyle}
          onClick={onRefresh}
          disabled={onlineLoading}
        >
          {onlineLoading ? "Loading..." : "↻ Refresh"}
        </button>
      )}
      {supportsSelection && sessionsCount > 0 && !selectMode && (
        <button
          className="select-mode-btn"
          style={goldButtonStyle}
          onClick={() => setSelectMode(true)}
        >
          Select sessions
        </button>
      )}
      {selectMode && (
        <>
          <button
            className="cancel-select-btn"
            style={goldButtonStyle}
            onClick={onCancelSelect}
          >
            Cancel
          </button>
          <button
            className="download-csv-btn"
            style={goldButtonStyle}
            disabled={selectedCount === 0}
            onClick={
              activeTab === "online"
                ? onDownloadSelectedOnline
                : onDownloadSelected
            }
          >
            Download ({selectedCount})
          </button>
          {activeTab !== "online" && (
            <button
              className="remove-button"
              style={{ fontSize: 12 }}
              disabled={selectedCount === 0}
              onClick={onDeleteSelected}
            >
              Delete ({selectedCount})
            </button>
          )}
        </>
      )}
      {supportsSelection && sessionsCount > 0 && (
        <div style={{ position: "relative" }} ref={filterButtonRef}>
          <button
            className="download-csv-btn"
            style={{
              ...goldButtonStyle,
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: hasActiveFilters
                ? "linear-gradient(135deg, var(--dark-gold), var(--gold))"
                : goldButtonStyle.background,
            }}
            onClick={() => {
              if (!filterOpen && filterButtonRef.current) {
                const rect = filterButtonRef.current.getBoundingClientRect();
                setDropdownPosition({
                  top: rect.bottom + 6,
                  left: rect.left,
                });
              }
              setFilterOpen((open) => !open);
            }}
          >
            <FaFilter size={11} />
            Filter
            {hasActiveFilters && (
              <span
                style={{
                  background: "rgba(0,0,0,0.3)",
                  borderRadius: "50%",
                  width: 16,
                  height: 16,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                {
                  [
                    filters.state,
                    filters.browser,
                    filters.os,
                    filters.resolution,
                    filters.datePeriod,
                  ].filter(Boolean).length
                }
              </span>
            )}
          </button>
          {filterOpen && (
            <SessionFilterDropdown
              {...props}
              totalCount={sessionsCount}
              filteredCount={filteredCount}
              position={dropdownPosition}
              dropdownRef={dropdownRef}
              onClose={() => setFilterOpen(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}
