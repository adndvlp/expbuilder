import { db, initDb } from "./database/lowdb";
import { ensureDbData } from "./database/ensureDbData";

export interface SessionResult {
  experimentID: string;
  sessionId: string;
  createdAt: string;
  data: any[];
}

// Crear una nueva sesión (solo si no existe)
export async function createSessionResult(
  experimentID: string,
  sessionId: string
): Promise<{ success: boolean; participantNumber?: number; error?: string }> {
  await initDb();
  await db.read();
  ensureDbData(db);
  const exists = db.data.sessionResults.find(
    (s: any) => s.experimentID === experimentID && s.sessionId === sessionId
  );
  if (exists) return { success: false, error: "Session already exists" };
  const created = {
    experimentID,
    sessionId,
    createdAt: new Date().toISOString(),
    data: [],
  };
  db.data.sessionResults.push(created);
  await db.write();
  // Calcular participantNumber
  const sessions = db.data.sessionResults
    .filter((s: any) => s.experimentID === experimentID)
    .sort(
      (a: any, b: any) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  const participantNumber =
    sessions.findIndex((s: any) => s.sessionId === sessionId) + 1;
  return { success: true, participantNumber };
}

// Agregar una respuesta a una sesión existente
export async function appendSessionResult(
  experimentID: string,
  sessionId: string,
  response: any
): Promise<{ success: boolean; participantNumber?: number; error?: string }> {
  await initDb();
  await db.read();
  ensureDbData(db);
  const session = db.data.sessionResults.find(
    (s: any) => s.experimentID === experimentID && s.sessionId === sessionId
  );
  if (!session) return { success: false, error: "Session not found" };
  session.data.push(response);
  await db.write();
  // Calcular participantNumber
  const sessions = db.data.sessionResults
    .filter((s: any) => s.experimentID === experimentID)
    .sort(
      (a: any, b: any) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  const participantNumber =
    sessions.findIndex((s: any) => s.sessionId === sessionId) + 1;
  return { success: true, participantNumber };
}

// Obtener la lista de sesiones (sin data)
export async function getSessionResults(
  experimentID: string
): Promise<Omit<SessionResult, "data">[]> {
  await initDb();
  await db.read();
  ensureDbData(db);
  return db.data.sessionResults
    .filter((s: any) => s.experimentID === experimentID)
    .map(({ data, ...session }: any) => session)
    .sort(
      (a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}

// Obtener los datos de una sesión (para exportar)
export async function getSessionData(
  experimentID: string,
  sessionId: string
): Promise<any[] | null> {
  await initDb();
  await db.read();
  ensureDbData(db);
  const doc = db.data.sessionResults.find(
    (s: any) => s.experimentID === experimentID && s.sessionId === sessionId
  );
  return doc ? doc.data : null;
}

// Eliminar una sesión
export async function deleteSessionResult(
  experimentID: string,
  sessionId: string
): Promise<boolean> {
  await initDb();
  await db.read();
  ensureDbData(db);
  const idx = db.data.sessionResults.findIndex(
    (s: any) => s.experimentID === experimentID && s.sessionId === sessionId
  );
  if (idx === -1) return false;
  db.data.sessionResults.splice(idx, 1);
  await db.write();
  return true;
}
