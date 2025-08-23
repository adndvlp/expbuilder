import { ReactNode, useEffect, useState } from "react";
import DevModeContext from "../contexts/DevModeContext";
const API_URL = import.meta.env.VITE_API_URL;

type Props = {
  children: ReactNode;
};

export default function DevModeProvider({ children }: Props) {
  const [isDevMode, setDevMode] = useState<boolean>(false);
  const [code, setCode] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    setIsLoading(true);
    fetch(`${API_URL}/api/load-config`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.config) {
          setCode(data.config.generatedCode);
          setDevMode(data.isDevMode);
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
        const response = await fetch(`${API_URL}/api/save-config`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            config: { generatedCode: code },
            isDevMode: isDevMode,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to save dev mode state");
        }
      } catch (error) {
        console.error("Error saving dev mode:", error);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [isDevMode, code, isLoading]);

  return (
    <DevModeContext.Provider value={{ isDevMode, setDevMode, code, setCode }}>
      {children}
    </DevModeContext.Provider>
  );
}
