import React, { useState, useEffect, useRef } from "react";
import useTrials from "../../hooks/useTrials";
import Select from "react-select";
import TrialsConfig from "./components/TrialsConfig";
import WebGazer from "./components/TrialsConfig/components/WebGazer";
import PluginEditor from "../PluginEditor";
import usePlugins from "../../hooks/usePlugins";
const API_URL = import.meta.env.VITE_API_URL;

interface ConfigPanelProps {}

const ConfigPanel: React.FC<ConfigPanelProps> = ({}) => {
  const { selectedTrial, trials, setTrials, setSelectedTrial } = useTrials();
  const [selectedId, setSelectedId] = useState<string>("");
  const [pluginList, setPluginList] = useState<string[]>([]);
  const [pluginEditor, setPluginEditor] = useState<boolean>(false);
  const { isSaving, plugins, metadataError, setPlugins, setMetadataError } =
    usePlugins();
  // Detecta si el plugin seleccionado es custom/subido
  const isCustomPlugin =
    selectedId === "custom" || plugins.some((p) => p.name === selectedId);

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
  }, [plugins, isSaving]);

  useEffect(() => {
    if (selectedTrial?.plugin) {
      if (isSaving) return;
      setSelectedId(selectedTrial.plugin);
      // Evita el fetch si el plugin es 'webgazer'
      if (selectedTrial.plugin === "webgazer") {
        setMetadataError("");
        return;
      }
      // Si es custom/subido, no borra el error si no hay metadata
      fetch(`${API_URL}/metadata/${selectedTrial.plugin}.json`)
        .then((res) => {
          if (res.status === 404) {
            setMetadataError(`No info object in ${selectedTrial.plugin}`);
          } else {
            // Solo borra el error si no es custom/subido
            if (
              !(
                selectedTrial.plugin === "custom" ||
                plugins.some((p) => p.name === selectedTrial.plugin)
              )
            ) {
              setMetadataError("");
            }
          }
        })
        .catch(() => {
          setMetadataError(`No info object in ${selectedTrial.plugin}`);
        });
    } else {
      setSelectedId("");
      setMetadataError("");
    }
  }, [selectedTrial, plugins, isSaving]);

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
    new Set([
      ...pluginList
        .filter((plugin) => !plugins.some((p) => p.name === plugin))
        .map((plugin) => {
          // Para los plugin-webgazer válidos, los normalizamos a un solo valor
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
  const options = [
    { value: "new-plugin", label: "Create plugin" },
    ...filteredPlugins.map((plugin) => {
      const value = /plugin-webgazer/i.test(plugin) ? "webgazer" : plugin;
      return {
        value,
        label: value.replace(/^plugin-/, "").replace(/-/g, " "),
      };
    }),
    ...userPluginsOptions,
  ];

  const handleChange = (newValue: { label: string; value: string } | null) => {
    if (!newValue) return;

    setSelectedId(newValue.value);

    if (newValue.value === "new-plugin") {
      setPluginEditor(true);
      // Simula el click en '+ Write plugin' de PluginEditor
      const name = `plugin-${Date.now()}`;
      const newPlugin = {
        name,
        scripTag: `/plugins/${name}.js`,
        pluginCode: "",
        index: plugins.length,
      };
      // Agrega el nuevo plugin al array existente
      setPlugins([...plugins, newPlugin]);
      const newTrial = {
        id: Date.now() + Math.random(),
        plugin: newPlugin.name,
        type: "Trial",
        name: `${newPlugin.name.replace(/^plugin-/, "").replace(/-/g, " ")}`,
        parameters: {},
        trialCode: "",
        columnMapping: {},
        csvJson: [],
        csvColumns: [],
      };
      setTrials([...trials, newTrial]);
      setSelectedTrial(newTrial);
      return;
    }

    if (selectedTrial) {
      const updatedTrial = { ...selectedTrial, plugin: newValue.value };
      setTrials(
        trials.map((t) => (t.id === selectedTrial.id ? updatedTrial : t))
      );
      setSelectedTrial(updatedTrial);
    }
    // Si selecciona custom, limpia el editor y activa el checkbox
    if (newValue.value === "custom") {
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
              <PluginEditor />
            ) : (
              <>
                {/* Solo muestra el checkbox si el plugin seleccionado es custom/subido */}
                {isCustomPlugin && (
                  <div>
                    <label>
                      Edit Plugin
                      <input
                        type="checkbox"
                        checked={pluginEditor}
                        onChange={(e) => setPluginEditor(e.target.checked)}
                        disabled={metadataError ? true : false}
                      />
                    </label>
                    {/* Muestra el error si existe y no es custom */}
                    {metadataError && selectedId !== "custom" && (
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
                  </div>
                )}
                {/* Renderiza el editor si el checkbox está activo o hay error de metadata */}
                {isCustomPlugin && (pluginEditor || metadataError) && (
                  <PluginEditor />
                )}
              </>
            )}
          </div>

          {selectedId !== "new-plugin" &&
            !pluginEditor &&
            !metadataError &&
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
                  {isCustomPlugin && !metadataError && (
                    <TrialsConfig pluginName={selectedId} />
                  )}
                </div>
              </div>
            )}
          {/* Si no hay parámetros, muestra advertencia en vez de TrialsConfig */}
          {selectedId !== "new-plugin" &&
            !pluginEditor &&
            metadataError &&
            !selectedTrial?.parameters && (
              <span
                style={{
                  color: "#d32f2f",
                  fontWeight: 600,
                  marginLeft: 12,
                }}
              >
                ⚠️ No parameters extracted for this plugin
              </span>
            )}
        </div>
      </div>
    </div>
  );
};

export default ConfigPanel;
