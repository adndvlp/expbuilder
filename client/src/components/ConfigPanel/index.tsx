import React, { useState, useEffect, useRef } from "react";
import useTrials from "../../hooks/useTrials";
import Select from "react-select";
import TrialsConfig from "./TrialsConfig";
import WebGazer from "./TrialsConfig/WebGazer";
import PluginEditor from "../PluginEditor";
import usePlugins from "../../hooks/usePlugins";
import TrialLoops from "./TrialsConfig/LoopsConfig";
const API_URL = import.meta.env.VITE_API_URL;

interface ConfigPanelProps {}

const ConfigPanel: React.FC<ConfigPanelProps> = ({}) => {
  const { trials, setTrials, selectedTrial, setSelectedTrial, selectedLoop } =
    useTrials();
  const [selectedId, setSelectedId] = useState<string>("");
  const [pluginList, setPluginList] = useState<string[]>([]);
  const [pluginEditor, setPluginEditor] = useState<boolean>(false);
  const { isSaving, plugins, metadataError, setPlugins, setMetadataError } =
    usePlugins();
  // Detecta si el plugin seleccionado es custom/subido (subido por el usuario)
  const isCustomPlugin = plugins.some((p) => p.name === selectedId);
  const [metadata404, setMetadata404] = useState<boolean>(false);
  const prevPluginList = useRef<string[]>([]);

  useEffect(() => {
    if (isSaving) return;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/plugins-list`);
        const data = await res.json();
        const newPluginList = data.plugins || [];
        setPluginList(newPluginList);
        prevPluginList.current = newPluginList;
      } catch (err) {
        // Si la petición falla, muestra error global
        setMetadataError("Could not load plugin list");
      }
    })();
  }, [isSaving]);

  useEffect(() => {
    if (selectedTrial?.plugin) {
      if (isSaving) return;
      setSelectedId(selectedTrial.plugin);
      // Evita el fetch si el plugin es 'webgazer'
      if (selectedTrial.plugin === "webgazer") {
        setMetadataError("");
        setMetadata404(false);
        return;
      }
      fetch(`${API_URL}/metadata/${selectedTrial.plugin}.json`)
        .then((res) => {
          if (res.status === 404) {
            setMetadataError(`No valid info object in ${selectedTrial.plugin}`);
            setMetadata404(true);
          } else {
            setMetadataError("");
            setMetadata404(false);
          }
        })
        .catch(() => {
          setMetadataError(`No valid info object in ${selectedTrial.plugin}`);
          setMetadata404(true);
        });
    } else {
      setSelectedId("");
      setMetadataError("");
      setMetadata404(false);
    }
  }, [selectedTrial, plugins, isSaving]);

  if (selectedLoop) {
    return (
      <div className="config-panel">
        <TrialLoops loop={selectedLoop} />
      </div>
    );
  }

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

  // filteredPlugins solo incluye plugins del backend, nunca los subidos por el usuario
  const filteredPlugins = Array.from(
    new Set([
      ...pluginList
        .filter((plugin) => !plugins.some((p) => p.name === plugin))
        .map((plugin) => {
          if (/plugin-webgazer/i.test(plugin)) return "webgazer";
          return plugin;
        }),
      // Si hay plugins webgazer custom/subidos, agrega la opción 'webgazer' si no existe
      ...plugins
        .filter((p) => /plugin-webgazer/i.test(p.name))
        .map(() => "webgazer"),
    ])
  );

  // Agrega plugins subidos por el usuario al select
  const userPluginsOptions = plugins.map((p) => ({
    value: p.name,
    label: p.name.replace(/^plugin-/, "").replace(/-/g, " "),
  }));
  // Los plugins subidos por el usuario solo aparecen en userPluginsOptions
  const options = [
    ...filteredPlugins
      .filter((plugin) => !plugins.some((p) => p.name === plugin))
      .map((plugin) => {
        const value = /plugin-webgazer/i.test(plugin) ? "webgazer" : plugin;
        return {
          value,
          label: value.replace(/^plugin-/, "").replace(/-/g, " "),
        };
      }),
    ...userPluginsOptions,
    { value: "new-plugin", label: "Create plugin" },
  ];

  const handleChange = (newValue: { label: string; value: string } | null) => {
    if (!newValue) return;
    setSelectedId(newValue.value);

    if (newValue.value === "new-plugin") {
      // Genera nombre incremental: "1", "2", ...
      let nextNum = 1;
      const usedNames = plugins.map((p) => p.name);
      while (usedNames.includes(String(nextNum))) {
        nextNum++;
      }
      const name = String(nextNum);
      if (usedNames.includes(name)) {
        setMetadataError("Plugin name already exists");
        return;
      }
      setPluginEditor(true);
      const newPlugin = {
        name,
        scripTag: `/plugins/${name}.js`,
        pluginCode: "",
        index: plugins.length,
      };
      setPlugins([...plugins, newPlugin]);
      if (selectedTrial) {
        const updatedTrial = { ...selectedTrial, plugin: name };
        setTrials(
          trials.map((t) => (t.id === selectedTrial.id ? updatedTrial : t))
        );
        setSelectedTrial(updatedTrial);
      }
      setSelectedId(name);
      return;
    }

    if (selectedTrial) {
      const updatedTrial = { ...selectedTrial, plugin: newValue.value };
      setTrials(
        trials.map((t) => (t.id === selectedTrial.id ? updatedTrial : t))
      );
      setSelectedTrial(updatedTrial);
    }

    // Si selecciona un plugin subido por el usuario, activa el editor automáticamente
    if (plugins.some((p) => p.name === newValue.value)) {
      setPluginEditor(true);
    } else if (newValue.value === "custom") {
      setPluginEditor(true);
    } else {
      setPluginEditor(false);
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
              option: (base, state) => ({
                ...base,
                backgroundColor: state.isFocused
                  ? "var(--gold)"
                  : "var(--light-purple)",
                color: state.isFocused
                  ? "var(--text-light)"
                  : "var(--text-light)",
                fontWeight: state.isSelected ? 600 : 400,
                "&:hover": {
                  backgroundColor: "var(--gold)",
                  color: "var(--text-light)",
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
          <div>
            {/* Si selecciona "Nuevo plugin", solo renderiza PluginEditor */}
            {selectedId === "new-plugin" ? (
              <PluginEditor selectedPluginName={selectedId} />
            ) : (
              <>
                {/* Siempre muestra el checkbox y editor para plugins subidos por el usuario */}
                {isCustomPlugin && (
                  <div>
                    <label>
                      Edit Plugin
                      <input
                        type="checkbox"
                        checked={pluginEditor}
                        onChange={(e) => setPluginEditor(e.target.checked)}
                        disabled={metadata404}
                      />
                    </label>
                    {metadataError && (
                      <span
                        style={{
                          color: "#960909ff",
                          marginLeft: 12,
                          fontWeight: 600,
                        }}
                      >
                        ⚠️ {metadataError}
                      </span>
                    )}
                    {/* Renderiza el editor si el checkbox está activo o hay error de metadata */}
                    {(pluginEditor || metadataError) && (
                      <PluginEditor selectedPluginName={selectedId} />
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {selectedId !== "new-plugin" &&
            !pluginEditor &&
            !metadata404 &&
            selectedTrial?.parameters && (
              <div>
                <hr />
                <div>
                  {selectedId &&
                    selectedId !== "webgazer" &&
                    !isCustomPlugin &&
                    selectedId !== "Select a stimulus-response" && (
                      <TrialsConfig pluginName={selectedId} />
                    )}
                  {selectedId === "webgazer" && (
                    <WebGazer webgazerPlugins={webgazerPlugins} />
                  )}
                  {/* Si es custom/subido y hay parámetros, muestra TrialsConfig */}
                  {isCustomPlugin && !metadata404 && (
                    <TrialsConfig pluginName={selectedId} />
                  )}
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ConfigPanel;
