import { db, initDb } from "./database/lowdb";
import { v4 as uuidv4 } from "uuid";
import { runExperiment, runExperimentPreview } from "./runExperiment";

export interface Experiment {
  experimentID: string;
  name: string;
  description?: string;
  author?: string;
  createdAt: string;
  updatedAt: string;
  storage?: string;
}

export async function getExperiments(): Promise<Experiment[]> {
  await initDb();
  return (db.data?.experiments || []).sort(
    (a: Experiment, b: Experiment) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getExperimentById(
  experimentID: string
): Promise<Experiment | undefined> {
  await initDb();
  return db.data?.experiments.find(
    (e: Experiment) => e.experimentID === experimentID
  );
}

export async function addExperiment({
  name,
  description,
  author,
  storage,
}: Omit<Experiment, "experimentID" | "createdAt" | "updatedAt"> & {
  storage?: string;
}): Promise<Experiment> {
  await initDb();
  const experiment: Experiment = {
    experimentID: uuidv4(),
    name,
    description,
    author,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    storage,
  };
  db.data!.experiments.push(experiment);
  await db.write();
  // Crear HTML inicial vacío (sin código generado)
  await runExperiment(name, "");
  return experiment;
}

/**
 * Regenera el HTML del experimento usando el experimentID, igual que el endpoint backend.
 * Busca el nombre y ejecuta la lógica de runExperiment.
 * @param experimentID ID del experimento
 * @param generatedCode Código JS generado
 * @returns Ruta del archivo HTML generado
 * @throws Error si el experimento no existe o no tiene nombre, o si falta el código
 */
export async function runExperimentById(
  experimentID: string,
  generatedCode: string
): Promise<string> {
  await initDb();
  const experiment = db.data?.experiments.find(
    (e: Experiment) => e.experimentID === experimentID
  );
  if (!experiment || !experiment.name) {
    throw new Error("Experiment not found");
  }
  if (!generatedCode) {
    throw new Error("No generated code provided");
  }
  return runExperiment(experiment.name, generatedCode);
}

/**
 * Regenera el HTML de preview del experimento usando el experimentID, igual que el endpoint backend.
 * Busca el nombre y ejecuta la lógica de runExperimentPreview.
 * @param experimentID ID del experimento
 * @param generatedCode Código JS generado
 * @returns Ruta del archivo HTML generado
 * @throws Error si el experimento no existe o no tiene nombre, o si falta el código
 */
export async function runExperimentPreviewById(
  experimentID: string,
  generatedCode: string
): Promise<string> {
  await initDb();
  const experiment = db.data?.experiments.find(
    (e: Experiment) => e.experimentID === experimentID
  );
  if (!experiment || !experiment.name) {
    throw new Error("Experiment not found");
  }
  if (!generatedCode) {
    throw new Error("No generated code provided");
  }
  return runExperimentPreview(experiment.name, generatedCode);
}

export async function deleteExperiment(experimentID: string): Promise<boolean> {
  await initDb();
  const idx = db.data!.experiments.findIndex(
    (e: Experiment) => e.experimentID === experimentID
  );
  if (idx !== -1) {
    db.data!.experiments.splice(idx, 1);
    await db.write();
    return true;
  }
  return false;
}
