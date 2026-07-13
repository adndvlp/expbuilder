import { ParticipantFile, TabType } from "../types";

const API_URL = import.meta.env.VITE_API_URL;

type Props = {
  activeTab: TabType;
  sessionId: string;
  files: ParticipantFile[] | null | undefined;
  expanded: boolean;
  onToggle: (sessionId: string) => void;
  onDelete: (sessionId: string, fileId: string) => void;
};

function formatSize(sizeBytes: number): string {
  return sizeBytes < 1024 * 1024
    ? `${Math.round(sizeBytes / 1024)} KB`
    : `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function SessionFilesCell({
  activeTab,
  sessionId,
  files,
  expanded,
  onToggle,
  onDelete,
}: Props) {
  const isOnline = activeTab === "online";
  return (
    <td style={{ verticalAlign: "top" }}>
      <button
        className="download-csv-btn"
        style={{ fontSize: 11 }}
        onClick={() => onToggle(sessionId)}
      >
        {expanded ? "▲ Close" : `Files${files ? ` (${files.length})` : ""}`}
      </button>
      {expanded && (
        <div
          style={{
            marginTop: 6,
            minWidth: 220,
            padding: "6px 8px",
            background: "var(--surface, #1e1e1e)",
            border: "1px solid var(--border, #333)",
            borderRadius: 6,
            fontSize: 11,
          }}
        >
          {files == null ? (
            <span style={{ color: "#aaa" }}>Loading…</span>
          ) : files.length === 0 ? (
            <span style={{ color: "#aaa" }}>No files</span>
          ) : (
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              {files.map((file) => (
                <li
                  key={file.id}
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <a
                    href={isOnline ? file.url : `${API_URL}${file.url}`}
                    target="_blank"
                    rel="noreferrer"
                    download={isOnline ? undefined : file.originalName}
                    style={{
                      flex: 1,
                      color: "var(--gold, #FFD600)",
                      textDecoration: "none",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: 180,
                    }}
                    title={file.originalName}
                  >
                    {file.originalName}
                  </a>
                  <span style={{ color: "#888", flexShrink: 0 }}>
                    {formatSize(file.sizeBytes)}
                  </span>
                  {!isOnline && (
                    <button
                      style={{
                        background: "none",
                        border: "none",
                        color: "#ef4444",
                        cursor: "pointer",
                        padding: "0 2px",
                        fontSize: 12,
                        flexShrink: 0,
                      }}
                      title="Delete file"
                      onClick={() => onDelete(sessionId, file.id)}
                    >
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </td>
  );
}
