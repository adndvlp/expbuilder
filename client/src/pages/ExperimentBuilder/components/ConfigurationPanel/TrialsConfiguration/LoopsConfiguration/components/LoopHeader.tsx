interface Props {
  loopName?: string;
  saveIndicator: boolean;
  savingField: string | null;
  trialCount: number;
}

export default function LoopHeader(props: Props) {
  return (
    <>
      <h4 className="text-lg font-bold mb-3">{props.loopName || "Loop"}</h4>
      <div className="mb-2">
        <div
          style={{
            ...indicatorStyle,
            opacity: props.saveIndicator ? 1 : 0,
          }}
        >
          ✓ Saved {props.savingField ? `(${props.savingField})` : "Loop"}
        </div>
        <strong>Trials in loop:</strong> {props.trialCount} trial(s)
      </div>
    </>
  );
}

const indicatorStyle = {
  transition: "opacity 0.3s",
  color: "green",
  fontWeight: "500",
  position: "fixed" as const,
  top: "20px",
  right: "20px",
  zIndex: 1000,
  backgroundColor: "rgba(255, 255, 255, 0.9)",
  padding: "6px 12px",
  borderRadius: "4px",
  fontSize: "14px",
  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  border: "1px solid #22c55e",
};
