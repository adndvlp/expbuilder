import { createContext } from "react";
import { Loop, Trial } from "../components/ConfigPanel/types";

export type TimelineItem = {
  id: string | number;
  type: "trial" | "loop";
  name: string;
  branches?: (string | number)[];
  trials?: (string | number)[]; // Para loops
};

type TrialsContextType = {
  // Tres arrays planos
  trials: Trial[];
  loops: Loop[];
  timeline: TimelineItem[];

  // Estado de selección
  selectedTrial: Trial | null;
  setSelectedTrial: (trial: Trial | null) => void;
  selectedLoop: Loop | null;
  setSelectedLoop: (loop: Loop | null) => void;

  // Métodos singulares para Trial
  createTrial: (trial: Omit<Trial, "id">) => Promise<Trial>;
  getTrial: (id: string | number) => Promise<Trial | null>;
  updateTrial: (
    id: string | number,
    trial: Partial<Trial>
  ) => Promise<Trial | null>;
  deleteTrial: (id: string | number) => Promise<boolean>;

  // Métodos singulares para Loop
  createLoop: (loop: Omit<Loop, "id">) => Promise<Loop>;
  getLoop: (id: string | number) => Promise<Loop | null>;
  updateLoop: (
    id: string | number,
    loop: Partial<Loop>
  ) => Promise<Loop | null>;
  deleteLoop: (id: string | number) => Promise<boolean>;

  // Métodos para Timeline
  updateTimeline: (timeline: TimelineItem[]) => Promise<boolean>;

  // Método para cargar metadata (GET trials metadata)
  loadTrialsMetadata: () => Promise<void>;

  // Método para cargar metadata de trials/loops dentro de un loop
  getLoopTrialsMetadata: (loopId: string | number) => Promise<TimelineItem[]>;

  // Método para borrar todo (cuando se borra experimento)
  deleteAllTrials: () => Promise<boolean>;

  // Estado de carga
  isLoading: boolean;
};

const TrialsContext = createContext<TrialsContextType>({
  trials: [],
  loops: [],
  timeline: [],
  selectedTrial: null,
  setSelectedTrial: () => {},
  selectedLoop: null,
  setSelectedLoop: () => {},
  createTrial: async () => ({}) as Trial,
  getTrial: async () => null,
  updateTrial: async () => null,
  deleteTrial: async () => false,
  createLoop: async () => ({}) as Loop,
  getLoop: async () => null,
  updateLoop: async () => null,
  deleteLoop: async () => false,
  updateTimeline: async () => false,
  loadTrialsMetadata: async () => {},
  getLoopTrialsMetadata: async () => [],
  deleteAllTrials: async () => false,
  isLoading: false,
});

export default TrialsContext;
