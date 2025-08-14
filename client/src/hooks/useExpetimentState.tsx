import { useState, useEffect } from "react";

let experimentVersion = 0;
const listeners: (() => void)[] = [];

export const useExperimentState = () => {
  const [version, setVersion] = useState(experimentVersion);

  const incrementVersion = () => {
    experimentVersion++;
    listeners.forEach((listener) => listener());
  };

  const subscribe = (callback: () => void) => {
    listeners.push(callback);
    return () => {
      const index = listeners.indexOf(callback);
      if (index > -1) listeners.splice(index, 1);
    };
  };

  // Subscribe to changes - USAR useEffect, no useState
  useEffect(() => {
    const unsubscribe = subscribe(() => setVersion(experimentVersion));
    return unsubscribe;
  }, []);

  return { version, incrementVersion }; // RETORNAR version, no experimentVersion
};
