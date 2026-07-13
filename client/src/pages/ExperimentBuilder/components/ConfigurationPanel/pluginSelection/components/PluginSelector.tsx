import Select from "react-select";
import Switch from "react-switch";
import type { PluginOption } from "../types";
import { pluginSelectStyles, switchProps } from "../utils/styles";

interface Props {
  checked: boolean;
  onChange: (option: PluginOption | null) => void;
  onToggle: (checked: boolean) => void;
  options: PluginOption[];
  selectedId: string;
}

export default function PluginSelector({
  checked,
  onChange,
  onToggle,
  options,
  selectedId,
}: Props) {
  return (
    <>
      <div style={switchRowStyle}>
        <label htmlFor="jspsych-switch" style={switchLabelStyle}>
          Use jsPsych plugins
        </label>
        <Switch
          {...switchProps}
          onChange={onToggle}
          checked={checked}
          id="jspsych-switch"
          aria-label="Toggle jsPsych plugins"
        />
      </div>
      {checked && (
        <>
          <label htmlFor="pluginSelect">Select a plugin:</label>
          <Select
            id="pluginSelect"
            options={options}
            value={
              options.find((option) => option.value === selectedId) || null
            }
            onChange={onChange}
            placeholder="Select a stimulus-response"
            styles={pluginSelectStyles}
          />
        </>
      )}
    </>
  );
}

const switchRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "20px",
  padding: "12px 16px",
  backgroundColor: "var(--neutral-light)",
  borderRadius: "8px",
  border: "1px solid var(--neutral-mid)",
};

const switchLabelStyle = {
  fontSize: "15px",
  fontWeight: 600,
  color: "var(--text-dark)",
  cursor: "pointer",
  userSelect: "none" as const,
};
