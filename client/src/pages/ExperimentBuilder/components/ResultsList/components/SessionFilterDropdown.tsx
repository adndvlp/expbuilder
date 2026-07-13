import { Dispatch, RefObject, SetStateAction } from "react";
import { EMPTY_FILTERS, Filters } from "../types";

type FilterKey = keyof Filters;
type Option = { value: string; label: string };

type Props = {
  filters: Filters;
  setFilters: Dispatch<SetStateAction<Filters>>;
  browsers: string[];
  operatingSystems: string[];
  resolutions: string[];
  filteredCount: number;
  totalCount: number;
  hasActiveFilters: boolean;
  position: { top: number; left: number };
  dropdownRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
};

const selectStyle = {
  padding: "5px 8px",
  borderRadius: 6,
  border: "1px solid var(--neutral-mid, #444)",
  background: "var(--surface, #23272e)",
  color: "var(--text-dark, #f8f8f8)",
  fontSize: 12,
};

function FilterSelect({
  label,
  filterKey,
  value,
  options,
  setFilters,
}: {
  label: string;
  filterKey: FilterKey;
  value: string;
  options: Option[];
  setFilters: Dispatch<SetStateAction<Filters>>;
}) {
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        fontSize: 11,
        color: "var(--text-dark, #aaa)",
      }}
    >
      {label}
      <select
        value={value}
        onChange={(event) =>
          setFilters((current) => ({
            ...current,
            [filterKey]: event.target.value,
          }))
        }
        style={selectStyle}
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const asOptions = (values: string[]): Option[] =>
  values.map((value) => ({ value, label: value }));

export default function SessionFilterDropdown({
  filters,
  setFilters,
  browsers,
  operatingSystems,
  resolutions,
  filteredCount,
  totalCount,
  hasActiveFilters,
  position,
  dropdownRef,
  onClose,
}: Props) {
  return (
    <div
      ref={dropdownRef}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        zIndex: 9999,
        background: "var(--neutral-dark, #1a1a2e)",
        border: "1px solid var(--neutral-mid, #444)",
        borderRadius: 8,
        padding: "14px 16px 10px",
        minWidth: 220,
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <strong style={{ fontSize: 12 }}>Filter sessions</strong>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", cursor: "pointer" }}
        >
          ×
        </button>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          maxHeight: "55vh",
          overflowY: "auto",
        }}
      >
        <FilterSelect
          label="State"
          filterKey="state"
          value={filters.state}
          setFilters={setFilters}
          options={[
            { value: "initiated", label: "Initiated" },
            { value: "in-progress", label: "In Progress" },
            { value: "completed", label: "Completed" },
            { value: "abandoned", label: "Abandoned" },
          ]}
        />
        {browsers.length > 0 && (
          <FilterSelect
            label="Browser"
            filterKey="browser"
            value={filters.browser}
            options={asOptions(browsers)}
            setFilters={setFilters}
          />
        )}
        {operatingSystems.length > 0 && (
          <FilterSelect
            label="OS"
            filterKey="os"
            value={filters.os}
            options={asOptions(operatingSystems)}
            setFilters={setFilters}
          />
        )}
        {resolutions.length > 0 && (
          <FilterSelect
            label="Resolution"
            filterKey="resolution"
            value={filters.resolution}
            options={asOptions(resolutions)}
            setFilters={setFilters}
          />
        )}
        <FilterSelect
          label="Date"
          filterKey="datePeriod"
          value={filters.datePeriod}
          setFilters={setFilters}
          options={[
            { value: "today", label: "Today" },
            { value: "yesterday", label: "Yesterday" },
            { value: "7d", label: "Last 7 days" },
            { value: "30d", label: "Last 30 days" },
            { value: "90d", label: "Last 90 days" },
          ]}
        />
      </div>
      {hasActiveFilters && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            paddingTop: 8,
            marginTop: 8,
            borderTop: "1px solid var(--neutral-mid, #444)",
          }}
        >
          <span style={{ fontSize: 11, color: "#aaa" }}>
            {filteredCount} of {totalCount}
          </span>
          <button
            onClick={() => setFilters(EMPTY_FILTERS)}
            style={{
              background: "none",
              border: "none",
              color: "var(--danger, #ef4444)",
              fontSize: 11,
              cursor: "pointer",
              padding: 0,
            }}
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
