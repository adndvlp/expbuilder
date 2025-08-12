import { createContext } from "react";

type UrlContextType = {
  experimentUrl: string;
  setExperimentUrl: (url: string) => void;
};

const UrlContext = createContext<UrlContextType | undefined>(undefined);

export default UrlContext;
