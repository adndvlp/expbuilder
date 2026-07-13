import { openExternal } from "../../../../../lib/openExternal";
import { SessionMeta } from "../types";

const API_URL = import.meta.env.VITE_API_URL;

export async function downloadSessionsZip(
  selected: string[],
  experimentID: string | undefined,
) {
  if (selected.length === 0) return;
  try {
    const response = await fetch(`${API_URL}/api/download-sessions-zip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionIds: selected, experimentID }),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
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
}

export async function downloadSessionCsv(
  sessionId: string,
  experimentID: string | undefined,
) {
  try {
    const response = await fetch(
      `${API_URL}/api/download-session/${sessionId}/${experimentID}`,
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const csvText = await response.text();
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
}

export function downloadOnlineSessions(
  sessions: SessionMeta[],
  selected: string[],
) {
  sessions
    .filter(
      (session) => selected.includes(session.sessionId) && session.fileUrl,
    )
    .forEach((session, index) => {
      setTimeout(() => openExternal(session.fileUrl!), index * 400);
    });
}
