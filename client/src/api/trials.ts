import { db, initDb } from "./database/lowdb";
import { ensureDbData } from "./database/ensureDbData";

export interface Trial {
  id: number;
  [key: string]: any;
}

export interface TrialsDoc {
  experimentID: string;
  data: {
    trials: Trial[];
    [key: string]: any;
  };
  createdAt: string;
  updatedAt: string;
}

// Obtener los trials de un experimento
export async function getTrialsByExperimentID(
  experimentID: string
): Promise<Trial[] | null> {
  await initDb();
  await db.read();
  ensureDbData(db);
  const trialsDoc = db.data.trials.find(
    (t: any) => t.experimentID === experimentID
  );
  return trialsDoc ? trialsDoc.data.trials : null;
}

// Guardar (crear o actualizar) los trials de un experimento
export async function saveTrials(
  experimentID: string,
  trials: Trial[]
): Promise<TrialsDoc> {
  await initDb();
  await db.read();
  ensureDbData(db);
  const now = new Date().toISOString();
  const existingIndex = db.data.trials.findIndex(
    (t: any) => t.experimentID === experimentID
  );
  const trialsDoc: TrialsDoc = {
    experimentID,
    data: { trials },
    createdAt: now,
    updatedAt: now,
  };
  if (existingIndex !== -1) {
    trialsDoc.createdAt = db.data.trials[existingIndex].createdAt;
    db.data.trials[existingIndex] = trialsDoc;
  } else {
    db.data.trials.push(trialsDoc);
  }
  await db.write();
  return trialsDoc;
}

// Eliminar un trial individual por id
export async function deleteTrialById(
  experimentID: string,
  id: number
): Promise<boolean> {
  await initDb();
  await db.read();
  ensureDbData(db);
  const trialsDoc = db.data.trials.find(
    (t: any) => t.experimentID === experimentID
  );
  if (!trialsDoc || !trialsDoc.data || !Array.isArray(trialsDoc.data.trials))
    return false;
  const before = trialsDoc.data.trials.length;
  trialsDoc.data.trials = trialsDoc.data.trials.filter(
    (trial: Trial) => trial.id !== id
  );
  trialsDoc.updatedAt = new Date().toISOString();
  await db.write();
  return trialsDoc.data.trials.length < before;
}
