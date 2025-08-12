import { ReactNode, useEffect, useState } from "react";
import UrlContext from "../contexts/UrlContext";

type Props = {
  children: ReactNode;
};

export default function TrialsProvider({ children }: Props) {
  const [experimentUrl, setExperimentUrl] = useState<string>("");

  useEffect(() => {
    setExperimentUrl("http://localhost:3000/experiment");
  }, []);

  return (
    <UrlContext.Provider value={{ experimentUrl, setExperimentUrl }}>
      {children}
    </UrlContext.Provider>
  );
}
