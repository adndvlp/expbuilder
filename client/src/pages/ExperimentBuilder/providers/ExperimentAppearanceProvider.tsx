import { ReactNode, useEffect, useState } from "react";
import ExperimentAppearanceContext from "../contexts/ExperimentAppearanceContext";
import { getApiBaseUrl } from "../../../lib/apiBaseUrl";
import {
  ExperimentAppearance,
  DEFAULT_EXPERIMENT_APPEARANCE,
} from "../appearance";

const API_URL = getApiBaseUrl();

export default function ExperimentAppearanceProvider({
  children,
  experimentID,
}: {
  children: ReactNode;
  experimentID?: string;
}) {
  const [appearance, setAppearance] = useState<ExperimentAppearance>(
    DEFAULT_EXPERIMENT_APPEARANCE,
  );

  // Load the experiment appearance settings from the server.
  useEffect(() => {
    if (!experimentID) return;
    fetch(`${API_URL}/api/appearance-settings/${experimentID}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.settings) {
          setAppearance((prev) => ({
            ...prev,
            backgroundColor:
              data.settings.backgroundColor ?? prev.backgroundColor,
            fullScreen: data.settings.fullScreen ?? prev.fullScreen,
            progressBar: data.settings.progressBar ?? prev.progressBar,
          }));
        }
      })
      .catch((err) => console.warn("Could not load appearance settings:", err));
  }, [experimentID]);

  return (
    <ExperimentAppearanceContext.Provider value={{ appearance, setAppearance }}>
      {children}
    </ExperimentAppearanceContext.Provider>
  );
}
