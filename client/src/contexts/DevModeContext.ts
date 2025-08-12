import { createContext } from "react";

type DevModeContextType = {
  isDevMode: boolean;
  setDevMode: React.Dispatch<React.SetStateAction<boolean>>;
  code: string;
  setCode: React.Dispatch<React.SetStateAction<string>>;
};

const DevModeContext = createContext<DevModeContextType | undefined>(undefined);

export default DevModeContext;
