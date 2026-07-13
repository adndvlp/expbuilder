import { useState, useEffect } from "react";

let experimentVersion = 0;
const listeners = new Set<() => void>();

export const useExperimentState = () => {
  const [version, setVersion] = useState(experimentVersion);

  const incrementVersion = () => {
    experimentVersion++;
    listeners.forEach((listener) => listener());
  };

  const subscribe = (callback: () => void) => {
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  };

  // Subscribe to changes - USAR useEffect, no useState
  useEffect(() => {
    const unsubscribe = subscribe(() => setVersion(experimentVersion));
    return unsubscribe;
  }, []);

  return { version, incrementVersion }; // RETORNAR version, no experimentVersion
};
