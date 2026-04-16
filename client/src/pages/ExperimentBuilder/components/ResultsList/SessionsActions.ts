import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { SessionMeta, TabType, ParticipantFile } from ".";
import { collection, getDocs } from "firebase/firestore";
import { getFirebaseDb } from "../../../../lib/firebase";
import { openExternal } from "../../../../lib/openExternal";
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

export default function FetchSessions({
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

  // Fetch online sessions from Firestore session_metadata subcollection (one-time)
  const fetchOnlineSessions = async () => {
    if (!experimentID) return;
    setOnlineLoading(true);
    try {
      const db = await getFirebaseDb();
      const metadataRef = collection(
        db,
        "experiments",
        experimentID,
        "session_metadata",
      );
      const snapshot = await getDocs(metadataRef);
      const metaSessions: SessionMeta[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          _id: doc.id,
          sessionId: data.sessionId || doc.id,
          createdAt:
            data.createdAt || data.completedAt || new Date().toISOString(),
          state: (data.state as SessionMeta["state"]) || "completed",
          metadata: data.metadata || {},
          fileUrl: data.fileUrl || undefined,
        };
      });
      setOnlineSessions(metaSessions);
    } catch (error) {
      console.error(
        "Error fetching online session metadata from Firestore:",
        error,
      );
      setOnlineSessions([]);
    }
    setOnlineLoading(false);
  };

  // Use local endpoint to get sessions
  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/session-results/${experimentID}`);
      const data = await res.json();
      setAllSessions(data.sessions || []);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      setAllSessions([]);
    }
    setLoading(false);

    setSelected([]);
    setSelectMode(false);
  };

  // Lazy-load online sessions: only hit Firebase when the online tab is first opened
  useEffect(() => {
    if (activeTab === "online" && !onlineLoaded) {
      fetchOnlineSessions().then(() => setOnlineLoaded(true));
    }
  }, [activeTab]);

  // Filter sessions based on active tab
  useEffect(() => {
    if (activeTab === "preview") {
      // Preview results: sessionId contains "_result_"
      const sorted = allSessions
        .filter((s) => s.sessionId.includes("_result_"))
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      setSessions(sorted);
    } else if (activeTab === "local") {
      // Local experiments: combinar sesiones de DB con sesiones activas de WebSocket
      const dbLocalSessions = allSessions.filter(
        (s) =>
          !s.sessionId.includes("_result_") &&
          !s.sessionId.includes("online_") &&
          !s.isOnline,
      );

      // Merge con sesiones activas del WebSocket (prioridad a estado en tiempo real)
      const sessionMap = new Map<string, SessionMeta>();

      // Primero agregar las de DB
      dbLocalSessions.forEach((s) => sessionMap.set(s.sessionId, s));

      // Luego actualizar/agregar las activas del WebSocket
      localActiveSessions.forEach((s) => {
        const existing = sessionMap.get(s.sessionId);
        if (existing) {
          // Actualizar estado con el del WebSocket (más reciente)
          sessionMap.set(s.sessionId, {
            ...existing,
            state: s.state,
            metadata: { ...existing.metadata, ...s.metadata },
          });
        } else {
          // Agregar nueva sesión activa
          sessionMap.set(s.sessionId, s);
        }
      });

      setSessions(
        Array.from(sessionMap.values()).sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
      );
    } else if (activeTab === "online") {
      // Online experiments: usar directamente la metadata de Firestore (fuente única)
      setSessions(
        [...onlineSessions].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
      );
    }
  }, [activeTab, allSessions, onlineSessions, localActiveSessions]);

  useEffect(() => {
    fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experimentID]);

  // Use local endpoint to delete a session
  const handleDeleteSession = async (sessionId: string) => {
    if (!window.confirm("Are you sure you want to delete this session result?"))
      return;
    try {
      await fetch(
        `${API_URL}/api/session-results/${sessionId}/${experimentID}`,
        {
          method: "DELETE",
        },
      );
      fetchSessions();
    } catch (error) {
      console.error("Error deleting session:", error);
    }
  };

  // Delete multiple sessions using local endpoint
  const handleDeleteSelected = async () => {
    if (
      selected.length === 0 ||
      !window.confirm(`Delete ${selected.length} selected session(s)?`)
    )
      return;
    try {
      for (const sessionId of selected) {
        await fetch(
          `${API_URL}/api/session-results/${sessionId}/${experimentID}`,
          {
            method: "DELETE",
          },
        );
      }
      fetchSessions();
    } catch (error) {
      console.error("Error deleting sessions:", error);
    }
  };

  // Download multiple sessions as CSV and save them in a ZIP in the folder chosen by the user (Electron)
  const handleDownloadSelected = async () => {
    if (selected.length === 0) return;
    try {
      // Single request: server reads DB once, builds and returns the ZIP
      const res = await fetch(`${API_URL}/api/download-sessions-zip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionIds: selected, experimentID }),
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      // Call Electron to save the ZIP
      // @ts-expect-error - Electron API not typed
      const result = await window.electron.saveZipFile(
        Array.from(new Uint8Array(arrayBuffer)),
        "sessions.zip",
      );
      if (result.success) {
        alert("ZIP saved successfully.");
      } else {
        alert("Failed to save ZIP: " + (result.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Error downloading sessions:", error);
      alert("Failed to download selected sessions");
    }
  };

  // Handle individual and global selection
  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };
  const toggleSelectAll = () => {
    if (selected.length === sessions.length) setSelected([]);
    else setSelected(sessions.map((s) => s.sessionId));
  };

  const handleCancelSelect = () => {
    setSelectMode(false);
    setSelected([]);
  };

  // Download CSV using local endpoint
  const handleDownloadCSV = async (sessionId: string) => {
    try {
      const res = await fetch(
        `${API_URL}/api/download-session/${sessionId}/${experimentID}`,
      );
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const csvText = await res.text();
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${experimentID}_${sessionId}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading session:", error);
      alert("Failed to download session data");
    }
  };

  // Download online sessions by opening each fileUrl in the system browser
  const handleDownloadSelectedOnline = () => {
    const toDownload = sessions.filter(
      (s) => selected.includes(s.sessionId) && s.fileUrl,
    );
    toDownload.forEach((s, i) => {
      // Stagger opens slightly so the browser doesn't block them as popups
      setTimeout(() => {
        openExternal(s.fileUrl!);
      }, i * 400);
    });
  };

  const handleRefresh = () => {
    if (activeTab === "online") {
      fetchOnlineSessions();
    } else {
      fetchSessions();
    }
  };

  const fetchOnlineSessionFiles = async (
    sessionId: string,
  ): Promise<ParticipantFile[]> => {
    if (!experimentID) return [];
    try {
      const db = await getFirebaseDb();
      const filesRef = collection(
        db,
        "experiments",
        experimentID,
        "session_metadata",
        sessionId,
        "participant_files",
      );
      const snap = await getDocs(filesRef);
      return snap.docs.map((d) => {
        const data = d.data();
        return {
          id: data.fileId || d.id,
          sessionId: data.sessionId || null,
          filename: data.filename || data.originalName || "",
          originalName: data.originalName || d.id,
          mimeType: data.mimeType || "",
          sizeBytes: data.sizeBytes || 0,
          uploadedAt: data.uploadedAt || new Date().toISOString(),
          url: data.url || "",
        };
      });
    } catch (e) {
      console.error("Error fetching online participant files:", e);
      return [];
    }
  };

  return {
    handleDeleteSession,
    handleDownloadCSV,
    handleDeleteSelected,
    handleDownloadSelected,
    handleDownloadSelectedOnline,
    toggleSelect,
    toggleSelectAll,
    handleCancelSelect,
    handleRefresh,
    fetchOnlineSessionFiles,
  };
}
