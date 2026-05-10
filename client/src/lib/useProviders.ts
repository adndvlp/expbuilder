import { useEffect, useState, useSyncExternalStore } from "react";
import {
  loadProviders,
  getProvidersSnapshot,
  subscribeProviders,
} from "./providerCatalog";
import type { Provider } from "../components/Chat/providers";

export function useProviders(): { providers: Provider[]; loading: boolean } {
  const providers = useSyncExternalStore(subscribeProviders, getProvidersSnapshot);
  const [loading, setLoading] = useState(providers.length === 0);

  useEffect(() => {
    if (providers.length > 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    loadProviders().finally(() => setLoading(false));
  }, [providers.length]);

  return { providers, loading };
}
