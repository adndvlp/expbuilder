import { createContext } from "react";

export type CustomInitJsPsychParams = {
  local: Record<string, string>;
  public: Record<string, string>;
};

export type CustomPreInitCode = {
  local: string;
  public: string;
};

type DevModeContextType = {
  isDevMode: boolean;
  setDevMode: React.Dispatch<React.SetStateAction<boolean>>;
  isSaveMode: boolean;
  setSaveMode: React.Dispatch<React.SetStateAction<boolean>>;
  code: string;
  setCode: React.Dispatch<React.SetStateAction<string>>;
  customCode: string;
  setCustomCode: React.Dispatch<React.SetStateAction<string>>;
  customInitJsPsychParams: CustomInitJsPsychParams;
  setCustomInitJsPsychParam: (variant: "local" | "public", param: string, value: string) => void;
  customPreInitCode: CustomPreInitCode;
  setCustomPreInitCode: (variant: "local" | "public", value: string) => void;
};

const DevModeContext = createContext<DevModeContextType | undefined>(undefined);

export default DevModeContext;
