import { Editor } from "@monaco-editor/react";
import { useRef, useState } from "react";
import usePlugins from "../hooks/usePlugins";

interface Plugin {
  name: string;
  scripTag: string;
  pluginCode: string;
  index: number;
}

const PluginEditor: React.FC = () => {
  const { plugins, setPlugins } = usePlugins();
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [saveIndicator, setSaveIndicator] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autosaveTimeout = useRef<NodeJS.Timeout | null>(null);

  // Add plugins from file upload (multiple)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newPlugins: Plugin[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const name = file.name.replace(/\.js$/, "");
      const text = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.readAsText(file);
      });
      newPlugins.push({
        name,
        scripTag: `/plugins/${name}.js`,
        pluginCode: text,
        index: plugins.length + i,
      });
    }
    setPlugins([...plugins, ...newPlugins]);
    setSelectedIdx(plugins.length); // select first new plugin
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Add empty plugin
  const handleAddPlugin = () => {
    const name = `plugin-${plugins.length + 1}`;
    setPlugins([
      ...plugins,
      {
        name,
        scripTag: `/plugins/${name}.js`,
        pluginCode: "",
        index: plugins.length,
      },
    ]);
    setSelectedIdx(plugins.length);
  };

  // Update plugin field with autosave
  const handleChange = (idx: number, field: keyof Plugin, value: string) => {
    const updated = plugins.map((p, i) => {
      if (i !== idx) return p;
      if (field === "name") {
        return {
          ...p,
          name: value,
          scripTag: `/plugins/${value}.js`,
        };
      }
      return { ...p, [field]: value };
    });
    setPlugins(updated);
    // Debounced save indicator
    if (autosaveTimeout.current) clearTimeout(autosaveTimeout.current);
    autosaveTimeout.current = setTimeout(() => {
      setSaveIndicator(true);
      setTimeout(() => setSaveIndicator(false), 1500);
    }, 800);
  };

  // No need for local save effect, context provider handles persistence

  // Remove plugin (local and backend)
  const handleRemovePlugin = async (idx: number) => {
    window.confirm("Are you sure on deleting this plugin?");
    const pluginToDelete = plugins[idx];
    if (!pluginToDelete) return;
    // Remove from backend
    try {
      await fetch(`/api/delete-plugin/${pluginToDelete.index}`, {
        method: "DELETE",
      });
    } catch (err) {
      // Puedes mostrar un error si quieres
      console.error("Error deleting plugin from backend", err);
    }
    // Remove locally
    const updated = plugins.filter((_, i) => i !== idx);
    setPlugins(updated);
    if (selectedIdx === idx) setSelectedIdx(0);
    else if (selectedIdx > idx) setSelectedIdx(selectedIdx - 1);
  };

  // Horizontal selector for plugins
  const maxPerRow = 3;
  const rows = [];
  for (let i = 0; i < plugins.length; i += maxPerRow) {
    rows.push(plugins.slice(i, i + maxPerRow));
  }

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
      {/* Multi-file upload */}
      <div className="form-group">
        <label htmlFor="jsFiles" style={{ color: "var(--text-dark)" }}>
          Write or Upload JS file(s)
        </label>
        <input
          id="jsFiles"
          type="file"
          accept=".js"
          multiple
          ref={fileInputRef}
          onChange={handleFileUpload}
          style={{ marginBottom: 10 }}
        />
      </div>

      <button
        className="action-button"
        style={{ marginBottom: 16, color: "white" }}
        onClick={handleAddPlugin}
      >
        + Write plugin
      </button>

      {/* Selector de plugins */}
      <div>
        {rows.map((row, rowIdx) => (
          <div key={rowIdx} style={{ display: "flex", gap: 8 }}>
            {row.map((plugin, idx) => {
              const globalIdx = rowIdx * maxPerRow + idx;
              return (
                <div
                  key={globalIdx}
                  className={
                    "timeline-item" +
                    (selectedIdx === globalIdx ? " selected" : "")
                  }
                  style={{
                    minWidth: 100,
                    maxWidth: 160,
                    padding: "10px 16px",
                    background:
                      selectedIdx === globalIdx
                        ? "var(--dark-purple)"
                        : "var(--primary-purple)",
                    color: "var(--text-light)",
                    borderRadius: 8,
                    cursor: "pointer",
                    textAlign: "center",
                    fontWeight: 500,
                    boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                    border:
                      selectedIdx === globalIdx
                        ? "2px solid var(--gold)"
                        : "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                  onClick={() => setSelectedIdx(globalIdx)}
                >
                  <input
                    type="text"
                    value={plugin.name}
                    onChange={(e) =>
                      handleChange(globalIdx, "name", e.target.value)
                    }
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "inherit",
                      fontWeight: "bold",
                      fontSize: 14,
                      textAlign: "center",
                      width: "80px",
                    }}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Editor del plugin seleccionado */}
      {plugins[selectedIdx] && (
        <div>
          {/* scripTag is now set automatically based on name, no input shown */}
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
                value={plugins[selectedIdx].pluginCode}
                theme="vs-dark"
                onChange={(value) =>
                  handleChange(selectedIdx, "pluginCode", value || "")
                }
                options={{
                  automaticLayout: true,
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: "on",
                  wordWrap: "off",
                  folding: true,
                  // Mejoras para colorear sintaxis

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
                  // Configuración adicional para JavaScript
                  tabCompletion: "on",
                  acceptSuggestionOnEnter: "on",
                  snippetSuggestions: "top",
                }}
                height="100vh"
              />
            </div>
          </div>
        </div>
      )}

      {/* Remove Button: only show if there is at least one plugin */}
      {plugins.length > 0 && (
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
          onClick={() => handleRemovePlugin(selectedIdx)}
        >
          Delete Plugin
        </button>
      )}
    </div>
  );
};

export default PluginEditor;
