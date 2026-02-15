import React, { useState, useEffect, useRef } from "react";
import useTrials from "../../hooks/useTrials";
import Select from "react-select";
import Switch from "react-switch";
import TrialsConfig from "./TrialsConfiguration";
import Webgazer from "./TrialsConfiguration/Webgazer";
import PluginEditor from "../PluginEditor";
import usePlugins from "../../hooks/usePlugins";
import TrialLoops from "./TrialsConfiguration/LoopsConfiguration";
const API_URL = import.meta.env.VITE_API_URL;

const ConfigurationPanel: React.FC = () => {
  const { selectedTrial, selectedLoop, updateTrial } = useTrials();
  const [selectedId, setSelectedId] = useState<string>("plugin-dynamic");
  const [pluginList, setPluginList] = useState<string[]>([]);
  const [pluginEditor, setPluginEditor] = useState<boolean>(false);
  const { isSaving, plugins, metadataError, setPlugins, setMetadataError } =
    usePlugins();
  // Detecta si el plugin seleccionado es custom/subido (subido por el usuario)
  const isCustomPlugin = plugins.some((p) => p.name === selectedId);
  const [metadata404, setMetadata404] = useState<boolean>(false);
  const prevPluginList = useRef<string[]>([]);
  const [useJsPsychPlugins, setUseJsPsychPlugins] = useState<boolean>(false);

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
        setMetadataError("Could not load plugin list: " + err);
      }
    })();
  }, [isSaving]);

  useEffect(() => {
    if (selectedTrial?.plugin) {
      if (isSaving) return;
      setSelectedId(selectedTrial.plugin);
      // Detectar si se está usando un plugin de jsPsych o el dynamic
      setUseJsPsychPlugins(selectedTrial.plugin !== "plugin-dynamic");
      // Evita el fetch si el plugin es 'webgazer' o 'plugin-dynamic'
      if (
        selectedTrial.plugin === "webgazer" ||
        selectedTrial.plugin === "plugin-dynamic"
      ) {
        setMetadataError("");
        setMetadata404(false);
        return;
      }
      fetch(`${API_URL}/api/metadata/${selectedTrial.plugin}.json`)
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
      setSelectedId("plugin-dynamic");
      setUseJsPsychPlugins(false);
      setMetadataError("");
      setMetadata404(false);
    }
  }, [selectedTrial, plugins, isSaving]);

  if (selectedLoop) {
    return (
      <div className="config-panel">
        <TrialLoops key={selectedLoop.id} loop={selectedLoop} />
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
    /plugin-webgazer/i.test(plugin),
  );

  // filteredPlugins solo incluye plugins del backend, nunca los subidos por el usuario
  // Excluimos plugin-dynamic de la lista
  const filteredPlugins = Array.from(
    new Set([
      ...pluginList
        .filter(
          (plugin) =>
            !plugins.some((p) => p.name === plugin) &&
            plugin !== "plugin-dynamic",
        )
        .map((plugin) => {
          if (/plugin-webgazer/i.test(plugin)) return "webgazer";
          return plugin;
        }),
      // Si hay plugins webgazer custom/subidos, agrega la opción 'webgazer' si no existe
      ...plugins
        .filter((p) => /plugin-webgazer/i.test(p.name))
        .map(() => "webgazer"),
    ]),
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

  const handleSwitchChange = (checked: boolean) => {
    setUseJsPsychPlugins(checked);

    if (!checked) {
      // Cambiar a plugin-dynamic
      setSelectedId("plugin-dynamic");
      if (selectedTrial) {
        updateTrial(selectedTrial.id, { plugin: "plugin-dynamic" });
      }
    }
  };

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
        updateTrial(selectedTrial.id, { plugin: name });
      }
      setSelectedId(name);
      return;
    }

    if (selectedTrial) {
      updateTrial(selectedTrial.id, { plugin: newValue.value });
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
      <div className="input-section border">
        <div className="form-group">
          {/* Switch para alternar entre plugin dinámico y plugins de jsPsych */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "20px",
              padding: "12px 16px",
              backgroundColor: "var(--neutral-light)",
              borderRadius: "8px",
              border: "1px solid var(--neutral-mid)",
            }}
          >
            <label
              htmlFor="jspsych-switch"
              style={{
                fontSize: "15px",
                fontWeight: 600,
                color: "var(--text-dark)",
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              Use jsPsych plugins
            </label>
            <Switch
              onChange={handleSwitchChange}
              checked={useJsPsychPlugins}
              onColor="#f1c40f"
              onHandleColor="#ffffff"
              handleDiameter={24}
              uncheckedIcon={false}
              checkedIcon={false}
              boxShadow="0px 1px 3px rgba(0, 0, 0, 0.2)"
              activeBoxShadow="0px 0px 1px 8px rgba(61, 146, 180, 0.2)"
              height={20}
              width={44}
              id="jspsych-switch"
              aria-label="Toggle jsPsych plugins"
            />
          </div>

          {/* Solo mostrar el dropdown si useJsPsychPlugins está activado */}
          {useJsPsychPlugins && (
            <>
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
                      ? "var(--primary-blue)"
                      : "var(--neutral-mid)",
                    boxShadow: state.isFocused
                      ? "0 0 0 2px var(--primary-blue)"
                      : "none",
                    "&:hover": {
                      borderColor: "var(--primary-blue)",
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
                    backgroundColor: "var(--primary-blue)",
                    borderRadius: "6px",
                    boxShadow: "0 2px 8px rgba(61,146,180,0.08)",
                  }),
                  option: (base, state) => ({
                    ...base,
                    backgroundColor: state.isFocused
                      ? "var(--gold)"
                      : "var(--light-blue)",
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
                      ? "var(--primary-blue)"
                      : "var(--primary-blue)",
                    "&:hover": {
                      color: "var(--gold)",
                    },
                  }),
                  indicatorSeparator: (base) => ({
                    ...base,
                    backgroundColor: "var(--primary-blue)",
                  }),
                }}
              ></Select>
            </>
          )}

          <div>
            {/* Si selecciona "Nuevo plugin", solo renderiza PluginEditor */}
            {selectedId === "new-plugin" ? (
              <PluginEditor selectedPluginName={selectedId} />
            ) : (
              <>
                {/* Siempre muestra el checkbox y editor para plugins subidos por el usuario */}
                {isCustomPlugin && (
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        marginTop: "16px",
                        marginBottom: "8px",
                      }}
                    >
                      <Switch
                        checked={pluginEditor}
                        onChange={(checked) => setPluginEditor(checked)}
                        disabled={metadata404}
                        onColor="#f1c40f"
                        onHandleColor="#ffffff"
                        handleDiameter={24}
                        uncheckedIcon={false}
                        checkedIcon={false}
                        height={20}
                        width={44}
                      />
                      <label
                        style={{
                          margin: 0,
                          fontWeight: 500,
                          color: metadata404 ? "#999" : "var(--text-dark)",
                        }}
                      >
                        Edit Plugin
                      </label>
                    </div>
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

          {selectedId !== "new-plugin" && !pluginEditor && !metadata404 && (
            <div>
              <hr />
              <div>
                {/* Mostrar TrialsConfig para plugin-dynamic */}
                {selectedId === "plugin-dynamic" && (
                  <TrialsConfig pluginName={selectedId} />
                )}
                {/* Mostrar TrialsConfig para otros plugins */}
                {selectedId &&
                  selectedId !== "webgazer" &&
                  selectedId !== "plugin-dynamic" &&
                  !isCustomPlugin &&
                  selectedId !== "Select a stimulus-response" && (
                    <TrialsConfig pluginName={selectedId} />
                  )}
                {selectedId === "webgazer" && (
                  <Webgazer webgazerPlugins={webgazerPlugins} />
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

export default ConfigurationPanel;
