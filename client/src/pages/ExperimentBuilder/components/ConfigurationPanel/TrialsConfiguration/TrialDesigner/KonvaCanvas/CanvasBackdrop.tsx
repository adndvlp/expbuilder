export default function CanvasBackdrop({
  backgroundColor,
}: {
  backgroundColor: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: backgroundColor,
        pointerEvents: "none",
      }}
    />
  );
}
