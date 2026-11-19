import { useEffect, useRef, useState } from "react";

export function useSaveIndicator() {
  const [saveIndicator, setSaveIndicator] = useState(false);
  const [savingField, setSavingField] = useState<string | null>(null);
  const mounted = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
    };
  }, []);

  const showSaveIndicator = (fieldName?: string) => {
    if (!mounted.current) return;
    clearTimeout(timer.current);
    setSavingField(fieldName || null);
    setSaveIndicator(true);
    timer.current = setTimeout(() => {
      timer.current = undefined;
      setSaveIndicator(false);
      setSavingField(null);
    }, 1500);
  };

  return { saveIndicator, savingField, showSaveIndicator };
}
