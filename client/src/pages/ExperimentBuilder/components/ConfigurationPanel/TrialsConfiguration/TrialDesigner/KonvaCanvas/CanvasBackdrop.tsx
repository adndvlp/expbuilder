import { EXPERIMENTAL_HTML_SCENE_ENABLED } from "../experimentalScene/sceneModel";

interface Props {
  backgroundColor: string;
  stageScale: number;
}

export default function CanvasBackdrop({ backgroundColor, stageScale }: Props) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        border: "2px solid var(--neutral-mid)",
        borderRadius: "8px",
        overflow: "hidden",
        background: backgroundColor,
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        pointerEvents: "none",
      }}
    >
      {/* v8 ignore start -- legacy visuals are disabled by the HTML scene. */}
      {!EXPERIMENTAL_HTML_SCENE_ENABLED && (
        <div
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            backgroundImage: `
              linear-gradient(var(--neutral-mid) 1px, transparent 1px),
              linear-gradient(90deg, var(--neutral-mid) 1px, transparent 1px)
            `,
            backgroundSize: `${20 * stageScale}px ${20 * stageScale}px`,
            pointerEvents: "none",
          }}
        />
      )}
      {!EXPERIMENTAL_HTML_SCENE_ENABLED && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: "20px",
            height: "20px",
            margin: "-10px 0 0 -10px",
            border: "2px solid #ff6b6b",
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "-100vw",
              width: "200vw",
              height: "1px",
              background: "rgba(255, 107, 107, 0.3)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "-100vh",
              width: "1px",
              height: "200vh",
              background: "rgba(255, 107, 107, 0.3)",
            }}
          />
        </div>
      )}
      {/* v8 ignore stop */}
    </div>
  );
}
