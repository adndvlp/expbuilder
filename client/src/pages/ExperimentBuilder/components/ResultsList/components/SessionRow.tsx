import Switch from "react-switch";
import { openExternal } from "../../../../../lib/openExternal";
import { ParticipantFile, SessionMeta, TabType } from "../types";
import SessionFilesCell from "./SessionFilesCell";
import StateBadge from "./StateBadge";

type Props = {
  session: SessionMeta;
  activeTab: TabType;
  selectMode: boolean;
  selected: string[];
  files: ParticipantFile[] | null | undefined;
  filesExpanded: boolean;
  onToggleSelect: (sessionId: string) => void;
  onToggleFiles: (sessionId: string) => void;
  onDeleteFile: (sessionId: string, fileId: string) => void;
  onDownloadCsv: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
};

export default function SessionRow({
  session,
  activeTab,
  selectMode,
  selected,
  files,
  filesExpanded,
  onToggleSelect,
  onToggleFiles,
  onDeleteFile,
  onDownloadCsv,
  onDeleteSession,
}: Props) {
  const showsMetadata = activeTab === "local" || activeTab === "online";
  return (
    <tr>
      {selectMode && (
        <td>
          <Switch
            checked={selected.includes(session.sessionId)}
            onChange={() => onToggleSelect(session.sessionId)}
            onColor="#FFD600"
            onHandleColor="#ffffff"
            handleDiameter={20}
            uncheckedIcon={false}
            checkedIcon={false}
            height={18}
            width={38}
          />
        </td>
      )}
      <td>{session.sessionId}</td>
      <td>{new Date(session.createdAt).toLocaleString()}</td>
      {showsMetadata && (
        <>
          <td>
            <StateBadge state={session.state} />
          </td>
          <td>
            {session.metadata?.browser
              ? `${session.metadata.browser}${
                  session.metadata.browserVersion
                    ? " " + session.metadata.browserVersion
                    : ""
                }`
              : "-"}
          </td>
          <td>{session.metadata?.os || "-"}</td>
          <td>{session.metadata?.screenResolution || "-"}</td>
        </>
      )}
      <SessionFilesCell
        activeTab={activeTab}
        sessionId={session.sessionId}
        files={files}
        expanded={filesExpanded}
        onToggle={onToggleFiles}
        onDelete={onDeleteFile}
      />
      {activeTab === "online" && (
        <td>
          {session.fileUrl ? (
            <button
              className="download-csv-btn"
              onClick={() => openExternal(session.fileUrl!)}
              style={{ fontSize: 12 }}
            >
              Download
            </button>
          ) : (
            "-"
          )}
        </td>
      )}
      {activeTab !== "online" && (
        <td>
          <button
            className="download-csv-btn"
            onClick={() => onDownloadCsv(session.sessionId)}
          >
            CSV
          </button>
          {!selectMode && (
            <button
              className="remove-button"
              onClick={() => onDeleteSession(session.sessionId)}
            >
              Delete
            </button>
          )}
        </td>
      )}
      {activeTab === "online" && <td />}
    </tr>
  );
}
