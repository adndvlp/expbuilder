import { Dispatch, SetStateAction, useEffect, useState } from "react";
import {
  downloadOnlineSessions,
  downloadSessionCsv,
  downloadSessionsZip,
} from "./services/sessionDownloads";
import {
  loadOnlineSessionFiles,
  loadOnlineSessions,
} from "./services/onlineSessions";
import { ParticipantFile, SessionMeta, TabType } from "./types";

const API_URL = import.meta.env.VITE_API_URL;

type Props = {
  experimentID: string | undefined;
  localActiveSessions: SessionMeta[];
  activeTab: TabType;
  selected: string[];
  sessions: SessionMeta[];
  setSelected: Dispatch<SetStateAction<string[]>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setOnlineLoading: Dispatch<SetStateAction<boolean>>;
  setSessions: Dispatch<SetStateAction<SessionMeta[]>>;
  setSelectMode: Dispatch<SetStateAction<boolean>>;
};

export default function SessionsActions({
  experimentID,
  localActiveSessions,
  activeTab,
  selected,
  sessions,
  setSelected,
  setLoading,
  setOnlineLoading,
  setSessions,
  setSelectMode,
}: Props) {
  const [allSessions, setAllSessions] = useState<SessionMeta[]>([]);
  const [onlineSessions, setOnlineSessions] = useState<SessionMeta[]>([]);
  const [onlineLoaded, setOnlineLoaded] = useState(false);

  const fetchOnlineSessions = async () => {
    if (!experimentID) return;
    setOnlineLoading(true);
    try {
      setOnlineSessions(await loadOnlineSessions(experimentID));
    } catch (error) {
      console.error(
        "Error fetching online session metadata from Firestore:",
        error,
      );
      setOnlineSessions([]);
    }
    setOnlineLoading(false);
  };

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/api/session-results/${experimentID}`,
      );
      const data = await response.json();
      setAllSessions(data.sessions || []);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      setAllSessions([]);
    }
    setLoading(false);
    setSelected([]);
    setSelectMode(false);
  };

  useEffect(() => {
    if (activeTab === "online" && !onlineLoaded) {
      fetchOnlineSessions().then(() => setOnlineLoaded(true));
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "preview") {
      setSessions(
        allSessions
          .filter((session) => session.sessionId.includes("_result_"))
          .sort(
            (left, right) =>
              new Date(right.createdAt).getTime() -
              new Date(left.createdAt).getTime(),
          ),
      );
      return;
    }
    if (activeTab === "local") {
      const localSessions = allSessions.filter(
        (session) =>
          !session.sessionId.includes("_result_") &&
          !session.sessionId.includes("online_") &&
          !session.isOnline,
      );
      const sessionMap = new Map<string, SessionMeta>();
      localSessions.forEach((session) =>
        sessionMap.set(session.sessionId, session),
      );
      localActiveSessions.forEach((session) => {
        const existing = sessionMap.get(session.sessionId);
        sessionMap.set(
          session.sessionId,
          existing
            ? {
                ...existing,
                state: session.state,
                metadata: { ...existing.metadata, ...session.metadata },
              }
            : session,
        );
      });
      setSessions(
        Array.from(sessionMap.values()).sort(
          (left, right) =>
            new Date(right.createdAt).getTime() -
            new Date(left.createdAt).getTime(),
        ),
      );
      return;
    }
    setSessions(
      [...onlineSessions].sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime(),
      ),
    );
  }, [activeTab, allSessions, onlineSessions, localActiveSessions]);

  useEffect(() => {
    fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experimentID]);

  const handleDeleteSession = async (sessionId: string) => {
    if (
      !window.confirm("Are you sure you want to delete this session result?")
    ) {
      return;
    }
    try {
      await fetch(
        `${API_URL}/api/session-results/${sessionId}/${experimentID}`,
        { method: "DELETE" },
      );
      fetchSessions();
    } catch (error) {
      console.error("Error deleting session:", error);
    }
  };

  const handleDeleteSelected = async () => {
    if (
      selected.length === 0 ||
      !window.confirm(`Delete ${selected.length} selected session(s)?`)
    ) {
      return;
    }
    try {
      for (const sessionId of selected) {
        await fetch(
          `${API_URL}/api/session-results/${sessionId}/${experimentID}`,
          { method: "DELETE" },
        );
      }
      fetchSessions();
    } catch (error) {
      console.error("Error deleting sessions:", error);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
  };
  const toggleSelectAll = () => {
    if (selected.length === sessions.length) setSelected([]);
    else setSelected(sessions.map((session) => session.sessionId));
  };
  const handleCancelSelect = () => {
    setSelectMode(false);
    setSelected([]);
  };
  const handleRefresh = () => {
    if (activeTab === "online") fetchOnlineSessions();
    else fetchSessions();
  };
  const fetchOnlineSessionFiles = async (
    sessionId: string,
  ): Promise<ParticipantFile[]> => {
    if (!experimentID) return [];
    try {
      return await loadOnlineSessionFiles(experimentID, sessionId);
    } catch (error) {
      console.error("Error fetching online participant files:", error);
      return [];
    }
  };

  return {
    handleDeleteSession,
    handleDownloadCSV: (sessionId: string) =>
      downloadSessionCsv(sessionId, experimentID),
    handleDeleteSelected,
    handleDownloadSelected: () => downloadSessionsZip(selected, experimentID),
    handleDownloadSelectedOnline: () =>
      downloadOnlineSessions(sessions, selected),
    toggleSelect,
    toggleSelectAll,
    handleCancelSelect,
    handleRefresh,
    fetchOnlineSessionFiles,
  };
}
