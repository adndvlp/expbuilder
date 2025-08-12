import { ReactNode, useState, useEffect } from "react";
import TrialsContext from "../contexts/TrialsContext";
import { Trial } from "../components/ConfigPanel/types";

type Props = {
  children: ReactNode;
};

export default function TrialsProvider({ children }: Props) {
  const [trials, setTrials] = useState<Trial[]>([]);
  const [selectedTrial, setSelectedTrial] = useState<Trial | null>(null);

  useEffect(() => {
    fetch("/api/load-trials")
      .then((res) => res.json())
      .then((data) => {
        if (data.trials && data.trials.trials) {
          setTrials(data.trials.trials);
        }
      });
  }, []);

  return (
    <TrialsContext.Provider
      value={{ trials, setTrials, selectedTrial, setSelectedTrial }}
    >
      {children}
    </TrialsContext.Provider>
  );
}
