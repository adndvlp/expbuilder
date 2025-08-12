// hooks/usePluginParameters.ts
import { useEffect, useState } from "react";
import { loadPluginParameters } from "../utils/pluginParameterLoader";
import type { DataDefinition, FieldDefinition } from "../types";

export function usePluginParameters(pluginName: string) {
  const [parameters, setParameters] = useState<FieldDefinition[]>([]);
  const [data, setData] = useState<DataDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    loadPluginParameters(pluginName)
      .then(({ parameters, data }) => {
        if (isMounted) {
          setParameters(parameters);
          setData(data);
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [pluginName]);

  return { parameters, data, loading, error };
}
