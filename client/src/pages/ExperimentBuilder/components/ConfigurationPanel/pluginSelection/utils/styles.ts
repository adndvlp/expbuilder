import type { StylesConfig } from "react-select";
import type { PluginOption } from "../types";

export const switchProps = {
  onColor: "#f1c40f",
  onHandleColor: "#ffffff",
  handleDiameter: 24,
  uncheckedIcon: false,
  checkedIcon: false,
  boxShadow: "0px 1px 3px rgba(0, 0, 0, 0.2)",
  activeBoxShadow: "0px 0px 1px 8px rgba(61, 146, 180, 0.2)",
  height: 20,
  width: 44,
};

export const pluginSelectStyles: StylesConfig<PluginOption, false> = {
  control: (base, state) => ({
    ...base,
    backgroundColor: "var(--neutral-light)",
    color: "var(--text-dark)",
    borderColor: state.isFocused ? "var(--primary-blue)" : "var(--neutral-mid)",
    boxShadow: state.isFocused ? "0 0 0 2px var(--primary-blue)" : "none",
    "&:hover": { borderColor: "var(--primary-blue)" },
    borderRadius: "6px",
    height: "20%",
  }),
  singleValue: (base) => ({
    ...base,
    color: "var(--text-dark)",
    fontWeight: 500,
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: "var(--primary-blue)",
    borderRadius: "6px",
    boxShadow: "0 2px 8px rgba(61,146,180,0.08)",
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? "var(--gold)" : "var(--light-blue)",
    color: "var(--text-light)",
    fontWeight: state.isSelected ? 600 : 400,
    "&:hover": { backgroundColor: "var(--gold)", color: "var(--text-light)" },
  }),
  placeholder: (base) => ({
    ...base,
    color: "var(--text-dark)",
    fontStyle: "italic",
  }),
  input: (base) => ({ ...base, color: "var(--text-dark)" }),
  dropdownIndicator: (base) => ({
    ...base,
    color: "var(--primary-blue)",
    "&:hover": { color: "var(--gold)" },
  }),
  indicatorSeparator: (base) => ({
    ...base,
    backgroundColor: "var(--primary-blue)",
  }),
};
