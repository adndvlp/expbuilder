import React, { useState } from "react";
import { FaMobileAlt, FaTabletAlt, FaLaptop, FaDesktop } from "react-icons/fa";
import { CanvasStyles } from "./types";

const DEVICE_PRESETS = [
  {
    icon: FaMobileAlt,
    label: "Mobile",
    description: "375 × 725",
    width: 375,
    height: 725,
  },
  {
    icon: (props: any) => (
      <FaMobileAlt style={{ transform: "rotate(-90deg)" }} {...props} />
    ),
    label: "Mobile",
    description: "725 × 375",
    width: 725,
    height: 375,
  },
  {
    icon: FaTabletAlt,
    label: "Tablet",
    description: "768 × 725",
    width: 768,
    height: 725,
  },
  {
    icon: FaLaptop,
    label: "Laptop",
    description: "1440 × 763",
    width: 1440,
    height: 763,
  },
  {
    icon: FaDesktop,
    label: "Desktop",
    description: "2560 × 1450",
    width: 2560,
    height: 1450,
  },
];

type Props = {
  canvasStyles: CanvasStyles;
  setCanvasStyles: React.Dispatch<React.SetStateAction<CanvasStyles>>;
  stageScale: number;
  // Run Demo (ExperimentPreview) integration
  onRunDemo: () => void;
  onStopDemo: () => void;
  isDemoRunning: boolean;
};

function CanvasStylesBar({
  canvasStyles,
  setCanvasStyles,
  stageScale,
  onRunDemo,
  onStopDemo,
  isDemoRunning,
}: Props) {
  const [showCustomSize, setShowCustomSize] = useState(false);
  const [customW, setCustomW] = useState(String(canvasStyles.width));
  const [customH, setCustomH] = useState(String(canvasStyles.height));

  const isDeviceActive = (preset: (typeof DEVICE_PRESETS)[number]) =>
    canvasStyles.width === preset.width &&
    canvasStyles.height === preset.height;

  const handleDeviceSelect = (preset: (typeof DEVICE_PRESETS)[number]) => {
    setShowCustomSize(false);
    setCanvasStyles((prev) => ({
      ...prev,
      width: preset.width,
      height: preset.height,
    }));
  };

  const applyCustomSize = () => {
    const w = parseInt(customW, 10);
    const h = parseInt(customH, 10);
    if (w > 0 && h > 0) {
      setCanvasStyles((prev) => ({ ...prev, width: w, height: h }));
      setShowCustomSize(false);
    }
  };

  const scalePercent = Math.round(stageScale * 100);

  const divider = (
    <div
      style={{
        width: 1,
        height: 20,
        background: "rgba(255,255,255,0.25)",
        margin: "0 4px",
      }}
    />
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 12px",
        background: "var(--primary-blue)",
        borderBottom: "2px solid var(--neutral-mid)",
        flexWrap: "wrap",
        minHeight: "42px",
        position: "relative",
        zIndex: 10,
      }}
    >
      {/* Title */}
      <span
        style={{
          fontWeight: 700,
          fontSize: "13px",
          color: "var(--text-light)",
          marginRight: "4px",
          letterSpacing: "0.3px",
        }}
      >
        Experiment Layout
      </span>

      {divider}

      {/* Background color */}
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          cursor: "pointer",
          fontSize: "12px",
          color: "var(--text-light)",
          fontWeight: 500,
        }}
        title="Background color"
      >
        <span>BG</span>
        <div style={{ position: "relative", display: "inline-flex" }}>
          <input
            type="color"
            value={canvasStyles.backgroundColor}
            onChange={(e) =>
              setCanvasStyles((prev) => ({
                ...prev,
                backgroundColor: e.target.value,
              }))
            }
            style={{
              width: "28px",
              height: "22px",
              border: "2px solid rgba(255,255,255,0.4)",
              borderRadius: "4px",
              cursor: "pointer",
              padding: "1px",
              background: "transparent",
            }}
          />
        </div>
        <span
          style={{
            fontFamily: "monospace",
            fontSize: "11px",
            color: "rgba(255,255,255,0.75)",
          }}
        >
          {canvasStyles.backgroundColor}
        </span>
      </label>

      {divider}

      {/* Device preset icon buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
        {DEVICE_PRESETS.map((preset) => {
          const Icon = preset.icon;
          const active = isDeviceActive(preset);
          return (
            <button
              key={preset.label}
              onClick={() => handleDeviceSelect(preset)}
              title={`${preset.label} — ${preset.description}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "28px",
                height: "26px",
                borderRadius: "4px",
                border: active
                  ? "2px solid var(--gold)"
                  : "2px solid rgba(255,255,255,0.2)",
                background: active
                  ? "rgba(255,255,255,0.18)"
                  : "rgba(255,255,255,0.07)",
                color: active ? "var(--gold)" : "rgba(255,255,255,0.7)",
                cursor: "pointer",
                padding: 0,
                transition: "all 0.15s",
                fontSize: "14px",
              }}
              onMouseEnter={(e) => {
                if (!active)
                  e.currentTarget.style.background = "rgba(255,255,255,0.15)";
              }}
              onMouseLeave={(e) => {
                if (!active)
                  e.currentTarget.style.background = "rgba(255,255,255,0.07)";
              }}
            >
              <Icon />
            </button>
          );
        })}
        {/* Custom size toggle */}
        <button
          onClick={() => setShowCustomSize((v) => !v)}
          title="Custom size"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "26px",
            padding: "0 7px",
            borderRadius: "4px",
            border: showCustomSize
              ? "2px solid var(--gold)"
              : "2px solid rgba(255,255,255,0.2)",
            background: showCustomSize
              ? "rgba(255,255,255,0.18)"
              : "rgba(255,255,255,0.07)",
            color: showCustomSize ? "var(--gold)" : "rgba(255,255,255,0.7)",
            cursor: "pointer",
            fontSize: "11px",
            fontWeight: 600,
            transition: "all 0.15s",
          }}
        >
          Custom
        </button>
      </div>

      {/* Custom size inputs */}
      {showCustomSize && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <input
            type="number"
            value={customW}
            onChange={(e) => setCustomW(e.target.value)}
            placeholder="W"
            style={{
              width: "60px",
              fontSize: "12px",
              padding: "2px 4px",
              borderRadius: "4px",
              border: "1px solid rgba(255,255,255,0.4)",
              background: "rgba(255,255,255,0.1)",
              color: "var(--text-light)",
            }}
          />
          <span style={{ color: "var(--text-light)", fontSize: "12px" }}>
            ×
          </span>
          <input
            type="number"
            value={customH}
            onChange={(e) => setCustomH(e.target.value)}
            placeholder="H"
            style={{
              width: "60px",
              fontSize: "12px",
              padding: "2px 4px",
              borderRadius: "4px",
              border: "1px solid rgba(255,255,255,0.4)",
              background: "rgba(255,255,255,0.1)",
              color: "var(--text-light)",
            }}
          />
          <button
            onClick={applyCustomSize}
            style={{
              fontSize: "11px",
              padding: "2px 8px",
              borderRadius: "4px",
              border: "none",
              background: "var(--gold)",
              color: "var(--text-light)",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Apply
          </button>
        </div>
      )}

      {/* Current dimensions (read-only) */}
      <span
        style={{
          fontSize: "11px",
          color: "rgba(255,255,255,0.6)",
          fontFamily: "monospace",
        }}
      >
        {canvasStyles.width}×{canvasStyles.height}px
      </span>

      {divider}

      {/* Zoom level */}
      <span
        title="Current zoom level"
        style={{
          fontSize: "11px",
          color: "rgba(255,255,255,0.6)",
          fontFamily: "monospace",
          minWidth: "32px",
        }}
      >
        Zoom {scalePercent}%
      </span>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Run / Stop Demo button */}
      <button
        onClick={isDemoRunning ? onStopDemo : onRunDemo}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "5px 14px",
          borderRadius: "6px",
          border: "none",
          background: isDemoRunning
            ? "var(--danger)"
            : "linear-gradient(135deg, var(--gold), var(--dark-gold))",
          color: "var(--text-light)",
          fontWeight: 600,
          fontSize: "12px",
          cursor: "pointer",
          transition: "opacity 0.2s",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        title={
          isDemoRunning
            ? "Stop the preview"
            : "Run a live preview of this trial"
        }
      >
        {isDemoRunning ? "Stop Demo" : "Run Demo"}
      </button>
    </div>
  );
}

export default CanvasStylesBar;
