import { createContext } from "react";
import { Loop, Trial } from "../components/ConfigurationPanel/types";

export type TimelineItem = {
  id: string | number;
  type: "trial" | "loop";
  name: string;
  branches?: (string | number)[];
  trials?: (string | number)[]; // Para loops
};

type TrialsContextType = {
  // Tres arrays planos
  timeline: TimelineItem[];

  // Loop timeline para el loop activo
  loopTimeline: TimelineItem[];
  activeLoopId: string | number | null;

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
    trial: Partial<Trial>,
    newBranchTrial?: Trial,
  ) => Promise<Trial | null>;
  updateTrialField: (
    id: string | number,
    fieldName: string,
    value: any,
    updateSelectedTrial?: boolean,
  ) => Promise<boolean>;
  deleteTrial: (id: string | number) => Promise<boolean>;

  // Métodos singulares para Loop
  createLoop: (loop: Omit<Loop, "id">) => Promise<Loop>;
  getLoop: (id: string | number) => Promise<Loop | null>;
  updateLoop: (
    id: string | number,
    loop: Partial<Loop>,
    newBranchItem?: any,
  ) => Promise<Loop | null>;
  updateLoopField: (
    id: string | number,
    fieldName: string,
    value: any,
    updateSelectedLoop?: boolean,
  ) => Promise<boolean>;
  deleteLoop: (id: string | number) => Promise<boolean>;

  // Métodos para Timeline
  updateTimeline: (timeline: TimelineItem[]) => Promise<boolean>;

  // Método para cargar timeline (GET trials timeline)
  getTimeline: () => Promise<void>;

  // Método para cargar timeline de trials/loops dentro de un loop
  getLoopTimeline: (loopId: string | number) => Promise<TimelineItem[]>;

  // Método para limpiar loop timeline
  clearLoopTimeline: () => void;

  // Método para borrar todo (cuando se borra experimento)
  deleteAllTrials: () => Promise<boolean>;

  // Estado de carga
  isLoading: boolean;
};

const TrialsContext = createContext<TrialsContextType>({
  timeline: [],
  loopTimeline: [],
  activeLoopId: null,
  selectedTrial: null,
  setSelectedTrial: () => {},
  selectedLoop: null,
  setSelectedLoop: () => {},
  createTrial: async () => ({}) as Trial,
  getTrial: async () => null,
  updateTrial: async () => null,
  updateTrialField: async () => false,
  deleteTrial: async () => false,
  createLoop: async () => ({}) as Loop,
  getLoop: async () => null,
  updateLoop: async () => null,
  updateLoopField: async () => false,
  deleteLoop: async () => false,
  updateTimeline: async () => false,
  getTimeline: async () => {},
  getLoopTimeline: async () => [],
  clearLoopTimeline: () => {},
  deleteAllTrials: async () => false,
  isLoading: false,
});

export default TrialsContext;
