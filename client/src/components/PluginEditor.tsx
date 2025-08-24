import { Editor } from "@monaco-editor/react";
import { useRef, useState } from "react";
import useTrials from "../hooks/useTrials";
import usePlugins from "../hooks/usePlugins";
const API_URL = import.meta.env.VITE_API_URL;

interface Plugin {
  name: string;
  scripTag: string;
  pluginCode: string;
  index: number;
}

interface PluginEditorProps {
  selectedPluginName?: string;
}

const PluginEditor: React.FC<PluginEditorProps> = ({ selectedPluginName }) => {
  const { plugins, setPlugins } = usePlugins();
  const { trials, setTrials, setSelectedTrial } = useTrials();
  const [saveIndicator, setSaveIndicator] = useState(false);
  const [localPlugin, setLocalPlugin] = useState<Plugin | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autosaveTimeout = useRef<NodeJS.Timeout | null>(null);

  // Busca el plugin seleccionado por nombre
  const plugin =
    plugins.find((p) => p.name === selectedPluginName) || plugins[0];

  // Subir plugin solo si no hay uno presente
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const name = file.name.replace(/\.js$/, "");
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target?.result as string);
      reader.readAsText(file);
    });
    const newPlugin: Plugin = {
      name,
      scripTag: `/plugins/${name}.js`,
      pluginCode: text,
      index: plugins.length,
    };
    setPlugins([...plugins, newPlugin]);

    // Asigna el plugin subido al trial seleccionado (no crea trial nuevo)
    if (trials && setTrials && setSelectedTrial) {
      const selectedTrial =
        trials.find((t) => t.plugin === selectedPluginName) || trials[0];
      if (selectedTrial) {
        const updatedTrial = { ...selectedTrial, plugin: name };
        setTrials(
          trials.map((t) => (t.id === selectedTrial.id ? updatedTrial : t))
        );
        setSelectedTrial(updatedTrial);
      }
    }
    setLocalPlugin(newPlugin);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Actualizar plugin seleccionado
  const handleChange = (field: keyof Plugin, value: string) => {
    if (!plugin) return;
    let updated: Plugin;
    if (field === "name") {
      updated = {
        ...plugin,
        name: value,
        scripTag: `/plugins/${value}.js`,
      };
    } else {
      updated = { ...plugin, [field]: value };
    }
    setLocalPlugin(updated);
    if (autosaveTimeout.current) clearTimeout(autosaveTimeout.current);
    autosaveTimeout.current = setTimeout(() => {
      setPlugins(plugins.map((p) => (p.name === plugin.name ? updated : p)));
      setSaveIndicator(true);
      setTimeout(() => setSaveIndicator(false), 1500);
      setLocalPlugin(null);
    }, 5000);
  };

  // No need for local save effect, context provider handles persistence

  // Eliminar plugin único
  const handleRemovePlugin = async () => {
    if (!plugin) return;
    if (!window.confirm("Are you sure on deleting this plugin?")) return;
    // Remove from backend
    try {
      await fetch(`${API_URL}/api/delete-plugin/${plugin.index}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.error("Error deleting plugin from backend", err);
    }
    setPlugins([]);
    setTrials([]);
    setSelectedTrial(null);
  };

  return (
    <div
      className="config-panel"
      style={{
        background: "var(--neutral-light)",
        borderRadius: 8,
        boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
        margin: 0,
        overflowY: "auto",
        minHeight: "600px",
        maxHeight: "90vh",
        padding: "20px",
      }}
    >
      {/* Upload solo si no hay plugin */}

      <div className="form-group">
        <label htmlFor="jsFiles" style={{ color: "var(--text-dark)" }}>
          Upload JS plugin file
        </label>
        <input
          id="jsFiles"
          type="file"
          accept=".js"
          ref={fileInputRef}
          onChange={handleFileUpload}
          style={{ marginBottom: 10 }}
        />
      </div>

      {/* Editor para el plugin único */}
      {(localPlugin || plugin) && (
        <>
          <input
            type="text"
            value={(localPlugin || plugin).name}
            onChange={(e) => handleChange("name", e.target.value)}
            style={{
              background: "var(--neutral-light)",
              border: "2px solid var(--gold)",
              color: "var(--gold)",
              fontWeight: "bold",
              fontSize: 16,
              textAlign: "center",
              width: "100%",
              borderRadius: 8,
              boxShadow: "0 2px 8px rgba(255, 215, 0, 0.15)",
              margin: "12px auto 24px auto",
              outline: "none",
              transition: "border 0.3s, box-shadow 0.3s",
            }}
            onFocus={(e) => {
              e.currentTarget.style.border = "2px solid var(--primary-purple)";
              e.currentTarget.style.boxShadow =
                "0 4px 16px rgba(61,146,180,0.15)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.border = "2px solid var(--gold)";
              e.currentTarget.style.boxShadow =
                "0 2px 8px rgba(255, 215, 0, 0.15)";
            }}
          />
          <div className="form-group" style={{ marginBottom: 0 }}>
            <div
              id="plugin-save-indicator"
              style={{
                opacity: saveIndicator ? 1 : 0,
                transition: "opacity 0.3s",
                color: "green",
                marginTop: 0,
              }}
            >
              Saved Changes
            </div>
            <div
              style={{
                border: "1px solid var(--neutral-mid)",
                borderRadius: 6,
                marginBottom: 10,
              }}
            >
              <Editor
                defaultLanguage="javascript"
                value={(localPlugin || plugin).pluginCode}
                theme="vs-dark"
                onChange={(value) => handleChange("pluginCode", value || "")}
                options={{
                  automaticLayout: true,
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: "on",
                  wordWrap: "off",
                  folding: true,
                  bracketPairColorization: {
                    enabled: true,
                  },
                  colorDecorators: true,
                  suggest: {
                    showKeywords: true,
                    showSnippets: true,
                    showFunctions: true,
                    showConstants: true,
                    showVariables: true,
                  },
                  quickSuggestions: {
                    other: true,
                    comments: true,
                    strings: true,
                  },
                  tabCompletion: "on",
                  acceptSuggestionOnEnter: "on",
                  snippetSuggestions: "top",
                }}
                height="100vh"
              />
            </div>
          </div>
          <button
            className="remove-button"
            style={{
              fontSize: 14,
              padding: "8px 18px",
              margin: "16px 0 0 0",
              color: "#fff",
              background: "linear-gradient(90deg, #d32f2f 0%, #ff5252 100%)",
              border: "none",
              borderRadius: 6,
              boxShadow: "0 2px 8px rgba(211,47,47,0.15)",
              fontWeight: 600,
              letterSpacing: 0.5,
              cursor: "pointer",
              transition:
                "background 1s cubic-bezier(.4,0,.2,1), box-shadow 0.7s cubic-bezier(.4,0,.2,1)",
            }}
            onMouseOver={(e) => {
              const btn = e.currentTarget as HTMLButtonElement;
              btn.style.background =
                "linear-gradient(90deg, #b71c1c 0%, #ff1744 100%)";
              btn.style.boxShadow = "0 4px 12px rgba(211,47,47,0.25)";
            }}
            onMouseOut={(e) => {
              const btn = e.currentTarget as HTMLButtonElement;
              btn.style.background =
                "linear-gradient(90deg, #d32f2f 0%, #ff5252 100%)";
              btn.style.boxShadow = "0 2px 8px rgba(211,47,47,0.15)";
            }}
            onClick={handleRemovePlugin}
          >
            Delete Plugin
          </button>
        </>
      )}

      {/* ...eliminado render duplicado del botón Delete Plugin... */}
    </div>
  );
};

export default PluginEditor;
