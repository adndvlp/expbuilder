import React, { useState, useEffect } from "react";
import useTrials from "../../hooks/useTrials";
import Select from "react-select";
import TrialsConfig from "./components/TrialsConfig";
import WebGazer from "./components/TrialsConfig/components/WebGazer";
import PluginEditor from "../PluginEditor";

interface ConfigPanelProps {}

const ConfigPanel: React.FC<ConfigPanelProps> = ({}) => {
  const { selectedTrial, trials, setTrials, setSelectedTrial } = useTrials();
  const [selectedId, setSelectedId] = useState<string>("");
  const [pluginList, setPluginList] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/plugins-list")
      .then((res) => res.json())
      .then((data) => setPluginList(data.plugins || []));
  }, []);

  useEffect(() => {
    if (selectedTrial?.plugin) {
      setSelectedId(selectedTrial.plugin);
    } else {
      setSelectedId("");
    }
  }, [selectedTrial]);

  if (!selectedTrial) {
    return (
      <div className="config-panel">
        <div className="input-section">
          <p style={{ textAlign: "center", margin: "0" }}>
            Select a trial from the timeline or add a new one
          </p>
        </div>
      </div>
    );
  }

  const webgazerPlugins = pluginList.filter((plugin) =>
    /plugin-webgazer/i.test(plugin)
  );

  const filteredPlugins = Array.from(
    new Set(
      pluginList.map((plugin) => {
        // Para los plugin-webgazer válidos, los normalizamos a un solo valor
        if (/plugin-webgazer/i.test(plugin)) return "webgazer";
        return plugin;
      })
    )
  );

  const options = [
    { value: "custom", label: "Custom Plugin" },
    ...filteredPlugins.map((plugin) => {
      const value = /plugin-webgazer/i.test(plugin) ? "webgazer" : plugin;
      return {
        value,
        label: value.replace(/^plugin-/, "").replace(/-/g, " "),
      };
    }),
  ];

  const handleChange = (newValue: { label: string; value: string } | null) => {
    if (!newValue) return;

    setSelectedId(newValue.value);

    if (selectedTrial) {
      const updatedTrial = { ...selectedTrial, plugin: newValue.value };
      setTrials(
        trials.map((t) => (t.id === selectedTrial.id ? updatedTrial : t))
      );
      setSelectedTrial(updatedTrial);
    }
  };

  return (
    <div className="config-panel">
      <div className="input-section">
        <div className="form-group">
          <label htmlFor="pluginSelect">Select a plugin:</label>
          <Select
            id="pluginSelect"
            options={options}
            value={options.find((opt) => opt.value === selectedId) || null}
            onChange={handleChange}
            placeholder="Select a stimulus-response"
            styles={{
              control: (baseStyles, state) => ({
                ...baseStyles,
                backgroundColor: "var(--neutral-light)",
                color: "var(--text-dark)",
                borderColor: state.isFocused
                  ? "var(--primary-purple)"
                  : "var(--neutral-mid)",
                boxShadow: state.isFocused
                  ? "0 0 0 2px var(--primary-purple)"
                  : "none",
                "&:hover": {
                  borderColor: "var(--primary-purple)",
                },
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
                backgroundColor: "var(--primary-purple)",
                borderRadius: "6px",
                boxShadow: "0 2px 8px rgba(61,146,180,0.08)",
              }),

              // Placeholder
              option: (base, state) => ({
                ...base,
                backgroundColor: state.isFocused
                  ? "var(--gold)"
                  : "var(--light-purple)",
                color: state.isFocused
                  ? "var(--text-light)" // Text color when placeholder
                  : "var(--text-light)",
                fontWeight: state.isSelected ? 600 : 400,
                "&:hover": {
                  backgroundColor: "var(--gold)",
                  color: "var(--text-light)", // Text color when placeholder
                },
              }),
              placeholder: (base) => ({
                ...base,
                color: "var(--text-dark)",
                fontStyle: "italic",
              }),
              input: (base) => ({
                ...base,
                color: "var(--text-dark)",
              }),
              dropdownIndicator: (base, state) => ({
                ...base,
                color: state.isFocused
                  ? "var(--primary-purple)"
                  : "var(--primary-purple)",
                "&:hover": {
                  color: "var(--gold)",
                },
              }),
              indicatorSeparator: (base) => ({
                ...base,
                backgroundColor: "var(--primary-purple)",
              }),
            }}
          ></Select>

          <hr />
          <div>
            {selectedId &&
              selectedId !== "webgazer" &&
              selectedId !== "custom" &&
              selectedId !== "Select a stimulus-response" && (
                <TrialsConfig pluginName={selectedId} />
              )}
            {selectedId === "webgazer" && (
              <WebGazer webgazerPlugins={webgazerPlugins} />
            )}
            {selectedId === "custom" && <PluginEditor />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfigPanel;
