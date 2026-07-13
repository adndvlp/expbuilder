import { Dispatch, SetStateAction } from "react";

type Props = {
  activeTunnelUrl: string;
  lastPagesUrl: string;
  experimentID?: string;
  experimentUrl: string;
  tunnelCopyStatus: string;
  pagesCopyStatus: string;
  publishStatus: string;
  isPublishing: boolean;
  disabledByTokens: boolean;
  setTunnelCopyStatus: Dispatch<SetStateAction<string>>;
  setPagesCopyStatus: Dispatch<SetStateAction<string>>;
  onPublish: () => void;
};

async function copyWithStatus(
  value: string,
  success: string,
  setStatus: Dispatch<SetStateAction<string>>,
) {
  try {
    await navigator.clipboard.writeText(value);
    setStatus(success);
  } catch {
    setStatus("Failed to copy.");
  }
  setTimeout(() => setStatus(""), 2000);
}

export default function PublishControls({
  activeTunnelUrl,
  lastPagesUrl,
  experimentID,
  experimentUrl,
  tunnelCopyStatus,
  pagesCopyStatus,
  publishStatus,
  isPublishing,
  disabledByTokens,
  setTunnelCopyStatus,
  setPagesCopyStatus,
  onPublish,
}: Props) {
  const publishDisabled = isPublishing || !experimentUrl || disabledByTokens;
  return (
    <>
      {activeTunnelUrl && (
        <button
          style={{
            display: "block",
            width: "100%",
            padding: "10px 0",
            backgroundColor: "#604cafff",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 14,
            letterSpacing: "0.05em",
            cursor: "pointer",
            transition: "background-color 0.3s ease",
          }}
          onMouseEnter={(event) =>
            (event.currentTarget.style.backgroundColor = "#4a3a9a")
          }
          onMouseLeave={(event) =>
            (event.currentTarget.style.backgroundColor = "#604cafff")
          }
          onClick={() =>
            copyWithStatus(
              `${activeTunnelUrl}/${experimentID}`,
              "Tunnel link copied!",
              setTunnelCopyStatus,
            )
          }
        >
          Copy Tunnel Link
        </button>
      )}
      {tunnelCopyStatus && (
        <p
          style={{
            fontSize: 13,
            color: tunnelCopyStatus.includes("copied") ? "#4caf50" : "#f44336",
            textAlign: "center",
            fontWeight: 500,
          }}
        >
          {tunnelCopyStatus}
        </p>
      )}
      <button
        onClick={onPublish}
        disabled={publishDisabled}
        style={{
          display: "block",
          width: "100%",
          padding: "10px 0",
          backgroundColor: publishDisabled ? "#cccccc" : "#ff9800",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          fontWeight: 600,
          fontSize: 14,
          letterSpacing: "0.05em",
          marginTop: 16,
          cursor: publishDisabled ? "not-allowed" : "pointer",
          transition: "background-color 0.3s ease",
        }}
      >
        {isPublishing ? "Publishing..." : "Publish to GitHub Pages"}
      </button>
      {publishStatus && (
        <p
          style={{
            fontSize: 13,
            color: publishStatus.includes("Error") ? "#f44336" : "#4caf50",
            textAlign: "center",
            marginTop: 8,
            fontWeight: 500,
            wordBreak: "break-word",
          }}
        >
          {publishStatus}
        </p>
      )}
      {lastPagesUrl && (
        <button
          style={{
            display: "block",
            width: "100%",
            padding: "10px 0",
            backgroundColor: "#2196f3",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 14,
            letterSpacing: "0.05em",
            marginTop: 16,
            cursor: "pointer",
            transition: "background-color 0.3s ease",
          }}
          onMouseEnter={(event) =>
            (event.currentTarget.style.backgroundColor = "#1e88e5")
          }
          onMouseLeave={(event) =>
            (event.currentTarget.style.backgroundColor = "#2196f3")
          }
          onClick={() =>
            copyWithStatus(
              lastPagesUrl,
              "GitHub Pages link copied!",
              setPagesCopyStatus,
            )
          }
        >
          Copy GitHub Pages Link
        </button>
      )}
      {pagesCopyStatus && (
        <p
          style={{
            fontSize: 13,
            color: pagesCopyStatus.includes("copied") ? "#4caf50" : "#f44336",
            textAlign: "center",
            marginTop: 4,
            fontWeight: 500,
          }}
        >
          {pagesCopyStatus}
        </p>
      )}
    </>
  );
}
