import { ReactNode, useEffect, useState } from "react";
import UrlContext from "../contexts/UrlContext";
import { useExperimentID } from "../hooks/useExperimentID";

const API_URL = import.meta.env.VITE_API_URL;

type Props = {
  children: ReactNode;
};

export default function TrialsProvider({ children }: Props) {
  const [experimentUrl, setExperimentUrl] = useState<string>("");
  const [trialUrl, setTrialUrl] = useState<string>("");
  const experimentID = useExperimentID();

  useEffect(() => {
    setTrialUrl(`${API_URL}/trials-preview/${experimentID}`);
    setExperimentUrl(`${API_URL}/experiment/${experimentID}`);
  }, []);

  return (
    <UrlContext.Provider
      value={{ experimentUrl, setExperimentUrl, trialUrl, setTrialUrl }}
    >
      {children}
    </UrlContext.Provider>
  );
}
