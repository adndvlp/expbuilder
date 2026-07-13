import type { Provider } from "../types/providers";

export function isConnected(
  provider: Provider,
  apiKeys: Record<string, string>,
) {
  return !!apiKeys[provider.id]?.trim();
}
