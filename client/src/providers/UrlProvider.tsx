import { ReactNode, useEffect, useState } from "react";
import UrlContext from "../contexts/UrlContext";
const API_URL = import.meta.env.VITE_API_URL;

type Props = {
  children: ReactNode;
};

export default function TrialsProvider({ children }: Props) {
  const [experimentUrl, setExperimentUrl] = useState<string>("");
  const [trialUrl, setTrialUrl] = useState<string>("");

  useEffect(() => {
    setTrialUrl(`${API_URL}/trials-preview`);
    setExperimentUrl(`${API_URL}/experiment`);
  }, []);

  return (
    <UrlContext.Provider
      value={{ experimentUrl, setExperimentUrl, trialUrl, setTrialUrl }}
    >
      {children}
    </UrlContext.Provider>
  );
}
