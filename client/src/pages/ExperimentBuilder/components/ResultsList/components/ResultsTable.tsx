import Switch from "react-switch";
import { ParticipantFile, SessionMeta, TabType } from "../types";
import SessionRow from "./SessionRow";

type Props = {
  sessions: SessionMeta[];
  filteredSessions: SessionMeta[];
  activeTab: TabType;
  selectMode: boolean;
  selected: string[];
  hasActiveFilters: boolean;
  sessionFiles: Record<string, ParticipantFile[] | null | undefined>;
  expandedFileSession: string | null;
  onToggleSelect: (sessionId: string) => void;
  onToggleSelectAll: () => void;
  onToggleFiles: (sessionId: string) => void;
  onDeleteFile: (sessionId: string, fileId: string) => void;
  onDownloadCsv: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
};

export default function ResultsTable(props: Props) {
  const {
    sessions,
    filteredSessions,
    activeTab,
    selectMode,
    selected,
    hasActiveFilters,
    sessionFiles,
    expandedFileSession,
    onToggleSelectAll,
  } = props;
  const showsMetadata = activeTab === "local" || activeTab === "online";
  return (
    <div className="results-table-container">
      <table className="results-table">
        <thead>
          <tr>
            {selectMode && (
              <th style={{ width: 40 }}>
                <Switch
                  checked={
                    selected.length === sessions.length && sessions.length > 0
                  }
                  onChange={onToggleSelectAll}
                  onColor="#FFD600"
                  onHandleColor="#ffffff"
                  handleDiameter={20}
                  uncheckedIcon={false}
                  checkedIcon={false}
                  height={18}
                  width={38}
                />
              </th>
            )}
            <th>Session ID</th>
            <th>Date</th>
            {showsMetadata && (
              <>
                <th>State</th>
                <th>Browser</th>
                <th>OS</th>
                <th>Resolution</th>
              </>
            )}
            <th>Files</th>
            {activeTab === "online" && <th>File</th>}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredSessions.length === 0 && hasActiveFilters && (
            <tr>
              <td
                colSpan={99}
                style={{
                  textAlign: "center",
                  padding: 20,
                  color: "var(--text-dark, #aaa)",
                }}
              >
                No sessions match the current filters.
              </td>
            </tr>
          )}
          {filteredSessions.map((session) => (
            <SessionRow
              key={session._id}
              {...props}
              session={session}
              files={sessionFiles[session.sessionId]}
              filesExpanded={expandedFileSession === session.sessionId}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
