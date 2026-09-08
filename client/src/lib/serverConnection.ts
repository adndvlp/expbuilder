export const CONNECTION_CODE_PREFIX = "EXPB1";

export interface PublicFirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

interface ConnectionCodePayload {
  v: 1;
  firebase: PublicFirebaseConfig;
}

const REQUIRED_FIELDS: Array<keyof PublicFirebaseConfig> = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
];

const PROJECT_ID_PATTERN = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
const MAX_CODE_LENGTH = 12_000;

function normalizeFirebaseConfig(value: unknown): PublicFirebaseConfig {
  if (!value || typeof value !== "object") {
    throw new Error("This connection code is not valid.");
  }

  const source = value as Record<string, unknown>;
  const config = {} as PublicFirebaseConfig;
  for (const field of REQUIRED_FIELDS) {
    const fieldValue = source[field];
    if (typeof fieldValue !== "string" || !fieldValue.trim()) {
      throw new Error("This connection code is incomplete.");
    }
    config[field] = fieldValue.trim();
  }

  if (!PROJECT_ID_PATTERN.test(config.projectId)) {
    throw new Error("This connection code has an invalid server ID.");
  }

  return config;
}

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error("This connection code is not valid.");
  }
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function createConnectionCode(config: unknown): string {
  const payload: ConnectionCodePayload = {
    v: 1,
    firebase: normalizeFirebaseConfig(config),
  };
  return `${CONNECTION_CODE_PREFIX}.${toBase64Url(JSON.stringify(payload))}`;
}

export function readConnectionCode(code: string): PublicFirebaseConfig {
  const compactCode = code.replace(/\s/g, "");
  if (!compactCode || compactCode.length > MAX_CODE_LENGTH) {
    throw new Error("This connection code is not valid.");
  }

  const [prefix, encoded, extra] = compactCode.split(".");
  if (prefix !== CONNECTION_CODE_PREFIX || !encoded || extra !== undefined) {
    throw new Error("This connection code is not valid.");
  }

  let payload: Partial<ConnectionCodePayload>;
  try {
    payload = JSON.parse(
      fromBase64Url(encoded),
    ) as Partial<ConnectionCodePayload>;
  } catch {
    throw new Error("This connection code is not valid.");
  }

  if (payload.v !== 1) {
    throw new Error("This connection code was made by a newer app version.");
  }
  return normalizeFirebaseConfig(payload.firebase);
}

export function getConnectionMode(
  config: FirebaseConfig | null | undefined,
): "owner" | "member" | null {
  if (!config) return null;
  return config.connectionMode === "member" ? "member" : "owner";
}

export async function connectToSharedServer(
  code: string,
  electronApi: ElectronAPI | undefined = window.electron,
): Promise<{ projectId: string; restarting: boolean }> {
  if (!electronApi?.writeFirebaseConfig) {
    throw new Error("Shared servers are available in the desktop app.");
  }

  const firebaseConfig = readConnectionCode(code);
  const saved = await electronApi.writeFirebaseConfig({
    ...firebaseConfig,
    connectionMode: "member",
  });
  if (!saved.success) {
    throw new Error(saved.error || "The connection could not be saved.");
  }

  const restarting = Boolean(electronApi.restartApp);
  if (electronApi.restartApp) void electronApi.restartApp().catch(() => {});
  return { projectId: firebaseConfig.projectId, restarting };
}
