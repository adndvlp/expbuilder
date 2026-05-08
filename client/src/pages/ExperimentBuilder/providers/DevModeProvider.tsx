import { ReactNode, useCallback, useEffect, useState } from "react";
import DevModeContext, { CustomInitJsPsychParams, CustomPreInitCode } from "../contexts/DevModeContext";
import { useExperimentID } from "../hooks/useExperimentID";
const API_URL = import.meta.env.VITE_API_URL;

type Props = {
  children: ReactNode;
};

const EMPTY_PARAMS: CustomInitJsPsychParams = { local: {}, public: {} };
const EMPTY_PRE_INIT: CustomPreInitCode = { local: "", public: "" };

export default function DevModeProvider({ children }: Props) {
  const [isDevMode, setDevMode] = useState<boolean>(false);
  const [isSaveMode, setSaveMode] = useState<boolean>(false);
  const [code, setCode] = useState<string>("");
  const [customCode, setCustomCode] = useState<string>("");
  const [customInitJsPsychParams, setCustomInitJsPsychParams] = useState<CustomInitJsPsychParams>(EMPTY_PARAMS);
  const [customPreInitCode, setCustomPreInitCodeState] = useState<CustomPreInitCode>(EMPTY_PRE_INIT);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const experimentID = useExperimentID();

  useEffect(() => {
    setIsLoading(true);
    fetch(`${API_URL}/api/load-config/${experimentID}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.config) {
          setCode(data.config.generatedCode);
          setCustomCode(data.config.customCode ?? "");
          setCustomInitJsPsychParams(data.config.customInitJsPsychParams ?? EMPTY_PARAMS);
          setCustomPreInitCodeState(data.config.customPreInitCode ?? EMPTY_PRE_INIT);
          setDevMode(data.isDevMode);
          setSaveMode(data.isSaveMode ?? false);
        }
      })
      .catch((error) => {
        console.error("Error loading config:", error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/save-config/${experimentID}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              config: { generatedCode: code, customCode, customInitJsPsychParams, customPreInitCode },
              isDevMode: isDevMode,
              isSaveMode: isSaveMode,
            }),
          },
        );

        if (!response.ok) {
          throw new Error("Failed to save dev mode state");
        }
      } catch (error) {
        console.error("Error saving dev mode:", error);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [isDevMode, isSaveMode, code, customCode, customInitJsPsychParams, customPreInitCode, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const setCustomInitJsPsychParam = useCallback((variant: "local" | "public", param: string, value: string) => {
    setCustomInitJsPsychParams(prev => ({
      ...prev,
      [variant]: { ...prev[variant], [param]: value },
    }));
  }, []);

  const setCustomPreInitCode = useCallback((variant: "local" | "public", value: string) => {
    setCustomPreInitCodeState(prev => ({ ...prev, [variant]: value }));
  }, []);

  return (
    <DevModeContext.Provider
      value={{
        isDevMode, setDevMode,
        isSaveMode, setSaveMode,
        code, setCode,
        customCode, setCustomCode,
        customInitJsPsychParams, setCustomInitJsPsychParam,
        customPreInitCode, setCustomPreInitCode,
      }}
    >
      {children}
    </DevModeContext.Provider>
  );
}
