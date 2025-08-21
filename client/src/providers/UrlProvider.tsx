import { ReactNode, useEffect, useState } from "react";
import UrlContext from "../contexts/UrlContext";

type Props = {
  children: ReactNode;
};

export default function TrialsProvider({ children }: Props) {
  const [experimentUrl, setExperimentUrl] = useState<string>("");
  const [trialUrl, setTrialUrl] = useState<string>("");

  useEffect(() => {
    setTrialUrl("http://localhost:3000/trials-preview");
    setExperimentUrl("http://localhost:3000/experiment");
  }, []);

  return (
    <UrlContext.Provider
      value={{ experimentUrl, setExperimentUrl, trialUrl, setTrialUrl }}
    >
      {children}
    </UrlContext.Provider>
  );
}
