import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { SessionMeta, TabType } from ".";
import { getDatabase, ref, onValue } from "firebase/database";
import { initializeApp, getApps } from "firebase/app";
const API_URL = import.meta.env.VITE_API_URL;

type Props = {
  experimentID: string | undefined;
  localActiveSessions: SessionMeta[];
  activeTab: TabType;
  selected: string[];
  sessions: SessionMeta[];
  setSelected: Dispatch<SetStateAction<string[]>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
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
  setSessions,
  setSelectMode,
}: Props) {
  const [allSessions, setAllSessions] = useState<SessionMeta[]>([]);
  const [onlineSessions, setOnlineSessions] = useState<SessionMeta[]>([]);
  // Fetch online sessions from Firebase Realtime Database
  const fetchOnlineSessions = async () => {
    try {
      // Inicializar Firebase si no está inicializado
      let app;
      if (getApps().length === 0) {
        const firebaseConfig = {
          apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
          authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
          databaseURL:
            import.meta.env.VITE_FIREBASE_DATABASE_URL ||
            `https://${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseio.com`,
          projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
          storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
          appId: import.meta.env.VITE_FIREBASE_APP_ID,
        };
        app = initializeApp(firebaseConfig);
      } else {
        app = getApps()[0];
      }

      const database = getDatabase(app);
      const sessionsRef = ref(database, `sessions/${experimentID}`);

      // Escuchar cambios en tiempo real
      onValue(
        sessionsRef,
        (snapshot) => {
          const data = snapshot.val();
          if (data) {
            const sessionsList: SessionMeta[] = Object.entries(data).map(
              ([sessionId, sessionData]) => {
                const sd = sessionData as Record<string, unknown>;
                return {
                  _id: sessionId,
                  sessionId: sessionId,
                  createdAt:
                    (sd.startedAt as string) ||
                    (sd.createdAt as string) ||
                    new Date().toISOString(),
                  state:
                    (sd.state as "initiated" | "in-progress" | "completed") ||
                    "initiated",
                };
              },
            );
            setOnlineSessions(sessionsList);
          } else {
            setOnlineSessions([]);
          }
        },
        (error) => {
          console.error("Error fetching online sessions:", error);
          setOnlineSessions([]);
        },
      );
    } catch (error) {
      console.error("Error initializing Firebase:", error);
      setOnlineSessions([]);
    }
  };

  // Use local endpoint to get sessions
  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/session-results/${experimentID}`);
      const data = await res.json();
      setAllSessions(data.sessions || []);

      // Fetch online sessions from Firebase
      await fetchOnlineSessions();
    } catch (error) {
      console.error("Error fetching sessions:", error);
      setAllSessions([]);
    }
    setLoading(false);
    setSelected([]);
    setSelectMode(false);
  };

  // Filter sessions based on active tab
  useEffect(() => {
    if (activeTab === "preview") {
      // Preview results: sessionId contains "_result_"
      setSessions(allSessions.filter((s) => s.sessionId.includes("_result_")));
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

      setSessions(Array.from(sessionMap.values()));
    } else if (activeTab === "online") {
      // Online experiments: combinar sesiones de Firebase RT con metadata de db.json
      const onlineSessionsMap = new Map<string, SessionMeta>();

      // Primero agregar sesiones de Firebase Realtime DB (activas)
      onlineSessions.forEach((s) => onlineSessionsMap.set(s.sessionId, s));

      // Luego agregar/actualizar con metadata de db.json (persistidas)
      const dbOnlineSessions = allSessions.filter((s) => s.isOnline === true);
      dbOnlineSessions.forEach((s) => {
        const existing = onlineSessionsMap.get(s.sessionId);
        if (existing) {
          // Actualizar con metadata de db.json
          onlineSessionsMap.set(s.sessionId, {
            ...s,
            ...existing,
            metadata: { ...s.metadata, ...existing.metadata },
          });
        } else {
          // Sesión ya finalizada (solo en db.json, no en Firebase)
          onlineSessionsMap.set(s.sessionId, s);
        }
      });

      setSessions(Array.from(onlineSessionsMap.values()));
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
      // Download all CSVs
      const files = [];
      for (const sessionId of selected) {
        const res = await fetch(
          `${API_URL}/api/download-session/${sessionId}/${experimentID}`,
        );
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const csvText = await res.text();
        files.push({
          name: `${experimentID}_${sessionId}.csv`,
          content: csvText,
        });
      }
      // Call Electron to save the ZIP
      // @ts-expect-error - Electron API not typed
      const result = await window.electron.saveCsvZip(files, "sessions.zip");
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
  return {
    handleDeleteSession,
    handleDownloadCSV,
    handleDeleteSelected,
    handleDownloadSelected,
    toggleSelect,
    toggleSelectAll,
    handleCancelSelect,
  };
}
