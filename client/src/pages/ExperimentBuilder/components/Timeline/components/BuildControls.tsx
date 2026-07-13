import { openExternal } from "../../../../../lib/openExternal";

type Props = {
  submitStatus: string;
  isSubmitting: boolean;
  experimentUrl: string;
  experimentID?: string;
  tunnelStatus: string;
  isTunnelActive: boolean;
  isTunnelCreating: boolean;
  onBuild: () => void;
  onShare: () => void;
  onCloseTunnel: () => void;
};

export default function BuildControls({
  submitStatus,
  isSubmitting,
  experimentUrl,
  experimentID,
  tunnelStatus,
  isTunnelActive,
  isTunnelCreating,
  onBuild,
  onShare,
  onCloseTunnel,
}: Props) {
  const runnableUrl = localStorage.getItem("tunnelUrl") || experimentUrl;
  return (
    <>
      {submitStatus && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 4,
            backgroundColor: submitStatus.includes("success")
              ? "#d4edda"
              : submitStatus.includes("Failed") ||
                  submitStatus.includes("error")
                ? "#f8d7da"
                : "#cce5ff",
            color: submitStatus.includes("success")
              ? "#155724"
              : submitStatus.includes("Failed") ||
                  submitStatus.includes("error")
                ? "#721c24"
                : "#004085",
            textAlign: "center",
          }}
        >
          {submitStatus}
        </div>
      )}
      <div style={{ marginTop: 16 }}>
        <button
          className="run-experiment-btn"
          onClick={onBuild}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Processing..." : "Build Experiment"}
        </button>
      </div>
      <div style={{ marginTop: 16 }}>
        <button
          type="button"
          style={{
            display: "block",
            width: "100%",
            padding: "10px 0",
            backgroundColor: "#4caf50",
            color: "#fff",
            textAlign: "center",
            textDecoration: "none",
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 14,
            letterSpacing: "0.05em",
            transition: "background-color 0.3s ease",
            cursor: runnableUrl ? "pointer" : "not-allowed",
            opacity: runnableUrl ? 1 : 0.6,
          }}
          disabled={!runnableUrl}
          onClick={() => {
            const tunnelUrl = localStorage.getItem("tunnelUrl");
            const url = tunnelUrl
              ? `${tunnelUrl}/${experimentID}`
              : experimentUrl;
            if (url) openExternal(url);
          }}
          onMouseEnter={(event) => {
            if (runnableUrl)
              event.currentTarget.style.backgroundColor = "#43a047";
          }}
          onMouseLeave={(event) => {
            if (runnableUrl)
              event.currentTarget.style.backgroundColor = "#4caf50";
          }}
        >
          Run experiment
        </button>
        <button
          style={{
            display: "block",
            width: "100%",
            padding: "10px 0",
            backgroundColor:
              isTunnelActive || isTunnelCreating ? "#cccccc" : "#604cafff",
            color: "#fff",
            textAlign: "center",
            textDecoration: "none",
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 14,
            letterSpacing: "0.05em",
            marginTop: 16,
            transition: "background-color 0.3s ease",
            cursor:
              isTunnelActive || isTunnelCreating ? "not-allowed" : "pointer",
            opacity: isTunnelActive || isTunnelCreating ? 0.6 : 1,
          }}
          onClick={isTunnelActive || isTunnelCreating ? undefined : onShare}
          disabled={isTunnelActive || isTunnelCreating}
        >
          {isTunnelCreating ? "Creating tunnel..." : "Share Local Experiment"}
        </button>
        {tunnelStatus && (
          <p
            style={{
              fontSize: 13,
              color: "#4caf50",
              textAlign: "center",
              marginTop: 8,
              fontWeight: 500,
            }}
          >
            {tunnelStatus}
          </p>
        )}
        {isTunnelActive && (
          <button
            style={{ marginTop: 6, marginBottom: 16, width: "100%" }}
            onClick={onCloseTunnel}
            className="remove-button"
          >
            Close tunnel
          </button>
        )}
      </div>
    </>
  );
}
