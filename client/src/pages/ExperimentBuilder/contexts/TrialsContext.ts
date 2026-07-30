import { createContext } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Loop, Trial } from "../components/ConfigurationPanel/types";

export type TimelineItem = {
  id: string | number;
  type: "trial" | "loop";
  name: string;
  branches?: (string | number)[];
  trials?: (string | number)[]; // Para loops
  parentLoopId?: string | null;
};

export type LoopTimelineCacheEntry =
  | {
      status: "loading" | "ready";
      items: TimelineItem[];
      revision: number;
    }
  | {
      status: "error";
      items: TimelineItem[];
      revision: number;
      error: unknown;
    };

export type LoopTimelineCache = Record<string, LoopTimelineCacheEntry>;

export type LoopTimelineLoadOptions = {
  mode?: "activate" | "cache" | "query";
  forceRefresh?: boolean;
  throwOnError?: boolean;
};

export type NewBranchItem = Pick<TimelineItem, "id" | "name"> & {
  branches?: (string | number)[] | null;
  trials?: (string | number)[] | null;
  plugin?: unknown;
};

export type TrialsContextType = {
  // Tres arrays planos
  timeline: TimelineItem[];

  // Loop timeline para el loop activo
  loopTimeline: TimelineItem[];
  loopTimelineCache: LoopTimelineCache;
  activeLoopId: string | number | null;

  // Estado de selección
  selectedTrial: Trial | null;
  setSelectedTrial: Dispatch<SetStateAction<Trial | null>>;
  selectedLoop: Loop | null;
  setSelectedLoop: Dispatch<SetStateAction<Loop | null>>;

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
    value: unknown,
    updateSelectedTrial?: boolean,
  ) => Promise<boolean>;
  deleteTrial: (id: string | number) => Promise<boolean>;

  // Métodos singulares para Loop
  createLoop: (loop: Omit<Loop, "id">) => Promise<Loop>;
  getLoop: (id: string | number) => Promise<Loop | null>;
  updateLoop: (
    id: string | number,
    loop: Partial<Loop>,
    newBranchItem?: NewBranchItem,
  ) => Promise<Loop | null>;
  updateLoopField: (
    id: string | number,
    fieldName: string,
    value: unknown,
    updateSelectedLoop?: boolean,
  ) => Promise<boolean>;
  deleteLoop: (id: string | number) => Promise<boolean>;

  // Métodos para Timeline
  updateTimeline: (timeline: TimelineItem[]) => Promise<boolean>;

  // Método para cargar timeline (GET trials timeline)
  getTimeline: () => Promise<void>;

  // Método para cargar timeline de trials/loops dentro de un loop
  getLoopTimeline: (
    loopId: string | number,
    options?: LoopTimelineLoadOptions,
  ) => Promise<TimelineItem[]>;

  // Cambia el scope activo usando metadata previamente cargada.
  activateLoopTimeline: (loopId: string | number | null) => boolean;

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
  loopTimelineCache: {},
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
  activateLoopTimeline: () => false,
  clearLoopTimeline: () => {},
  deleteAllTrials: async () => false,
  isLoading: false,
});

export default TrialsContext;
