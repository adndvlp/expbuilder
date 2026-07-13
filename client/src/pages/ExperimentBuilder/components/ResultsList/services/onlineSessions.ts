import { collection, getDocs } from "firebase/firestore";
import { getFirebaseDb } from "../../../../../lib/firebase";
import { ParticipantFile, SessionMeta } from "../types";

export async function loadOnlineSessions(
  experimentID: string,
): Promise<SessionMeta[]> {
  const db = await getFirebaseDb();
  const metadataRef = collection(
    db,
    "experiments",
    experimentID,
    "session_metadata",
  );
  const snapshot = await getDocs(metadataRef);
  return snapshot.docs.map((document) => {
    const data = document.data();
    return {
      _id: document.id,
      sessionId: data.sessionId || document.id,
      createdAt: data.createdAt || data.completedAt || new Date().toISOString(),
      state: (data.state as SessionMeta["state"]) || "completed",
      metadata: data.metadata || {},
      fileUrl: data.fileUrl || undefined,
    };
  });
}

export async function loadOnlineSessionFiles(
  experimentID: string,
  sessionId: string,
): Promise<ParticipantFile[]> {
  const db = await getFirebaseDb();
  const filesRef = collection(
    db,
    "experiments",
    experimentID,
    "session_metadata",
    sessionId,
    "participant_files",
  );
  const snapshot = await getDocs(filesRef);
  return snapshot.docs.map((document) => {
    const data = document.data();
    return {
      id: data.fileId || document.id,
      sessionId: data.sessionId || null,
      filename: data.filename || data.originalName || "",
      originalName: data.originalName || document.id,
      mimeType: data.mimeType || "",
      sizeBytes: data.sizeBytes || 0,
      uploadedAt: data.uploadedAt || new Date().toISOString(),
      url: data.url || "",
    };
  });
}
