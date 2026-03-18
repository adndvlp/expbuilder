import { useEffect, useState } from "react";
import ReactSwitch from "react-switch";

const API_URL = import.meta.env.VITE_API_URL;

type Props = {
  experimentID: string | undefined;
};

function AppearanceSettings({ experimentID }: Props) {
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [fullScreen, setFullScreen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!experimentID) return;
    fetch(`${API_URL}/api/appearance-settings/${experimentID}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.settings) {
          setBackgroundColor(data.settings.backgroundColor ?? "#ffffff");
          setFullScreen(data.settings.fullScreen ?? false);
        }
      })
      .catch((err) => console.error("Error loading appearance settings:", err));
  }, [experimentID]);

  const handleSave = async () => {
    if (!experimentID) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(
        `${API_URL}/api/appearance-settings/${experimentID}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ backgroundColor, fullScreen }),
        },
      );
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: "Appearance settings saved!" });
      } else {
        setMessage({
          type: "error",
          text: data.error || "Error saving settings.",
        });
      }
    } catch (err) {
      console.error("Error saving appearance settings:", err);
      setMessage({ type: "error", text: "Error saving settings." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ marginTop: 40, marginBottom: 32 }}>
      <h2 style={{ color: "var(--text-dark)", marginBottom: 8, fontSize: 24 }}>
        Experiment Appearance
      </h2>
      <p
        style={{
          color: "var(--text-dark)",
          fontSize: 14,
          opacity: 0.8,
          marginBottom: 20,
        }}
      >
        Configure the background color and fullscreen behavior of the experiment
        canvas. These settings apply to the live experiment and the builder
        preview.
      </p>

      {/* Background Color */}
      <div style={{ marginBottom: 24 }}>
        <label
          htmlFor="appearanceBg"
          style={{
            display: "block",
            fontSize: 15,
            fontWeight: 600,
            color: "var(--text-dark)",
            marginBottom: 8,
          }}
        >
          Background Color
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input
            id="appearanceBg"
            type="color"
            value={backgroundColor}
            onChange={(e) => setBackgroundColor(e.target.value)}
            style={{
              width: 44,
              height: 36,
              border: "2px solid var(--neutral-mid)",
              borderRadius: 6,
              cursor: "pointer",
              padding: 2,
              backgroundColor: "var(--neutral-light)",
            }}
          />
          <input
            type="text"
            value={backgroundColor}
            onChange={(e) => setBackgroundColor(e.target.value)}
            maxLength={20}
            style={{
              padding: "6px 10px",
              fontSize: 14,
              border: "2px solid var(--neutral-mid)",
              borderRadius: 6,
              width: 120,
              backgroundColor: "var(--neutral-light)",
              color: "var(--text-dark)",
              fontFamily: "monospace",
            }}
          />
        </div>
        <p
          style={{
            marginTop: 6,
            fontSize: 13,
            color: "var(--text-dark)",
            opacity: 0.65,
          }}
        >
          The background color shown behind the experiment content.
        </p>
      </div>

      {/* Full Screen toggle */}
      <div style={{ marginBottom: 24 }}>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            cursor: "pointer",
          }}
        >
          <ReactSwitch
            checked={fullScreen}
            onChange={setFullScreen}
            height={22}
            width={44}
            handleDiameter={16}
            onColor="#3b82f6"
            offColor="#9ca3af"
            uncheckedIcon={false}
            checkedIcon={false}
          />
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text-dark)",
            }}
          >
            Full Screen Mode
          </span>
        </label>
        <p
          style={{
            marginTop: 6,
            fontSize: 13,
            color: "var(--text-dark)",
            opacity: 0.65,
            marginLeft: 56,
          }}
        >
          When enabled, the experiment fills the entire browser viewport instead
          of a fixed-size canvas.
        </p>
      </div>

      {/* Save button */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button
          onClick={handleSave}
          disabled={saving}
          className="gradient-btn"
          style={{
            opacity: saving ? 0.6 : 1,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving..." : "Save Appearance"}
        </button>
        {message && (
          <p
            style={{
              color: message.type === "success" ? "#4caf50" : "#f44336",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}

export default AppearanceSettings;
