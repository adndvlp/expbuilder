import { useCallback, useEffect, useRef, useState } from "react";
import { openExternal } from "../../../lib/openExternal";
import {
  EMPTY_OAUTH,
  oauthStateFromConfig,
  parseLoginToken,
  parseLoginUrl,
  sanitizeBackendLog,
  type BackendOAuthState,
  type BackendSetupPersistState,
} from "../../../lib/backendSetup";

export const isElectron = !!window.electron?.startBackendSetup;

export interface ExitData {
  id: string;
  code: number | null;
  error: string | null;
  output: string;
}

export function useBackendSession() {
  const [logs, setLogs] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [token, setToken] = useState("");
  const [loginUrl, setLoginUrl] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [projectId, setProjectId] = useState("");
  const [projectDone, setProjectDone] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [billingDone, setBillingDone] = useState(false);
  const [firestoreDone, setFirestoreDone] = useState(false);
  const [authDone, setAuthDone] = useState(false);
  const [deployed, setDeployed] = useState(false);
  const [googleAuthNeedsConsole, setGoogleAuthNeedsConsole] = useState(false);
  const [oauth, setOauth] = useState<BackendOAuthState>(EMPTY_OAUTH);
  const exitListeners = useRef<Map<string, (data: ExitData) => void>>(new Map());
  const loginIdRef = useRef("");
  const openedLoginUrl = useRef("");
  const persistRef = useRef<BackendSetupPersistState>({});

  const appendLog = useCallback((text: string) => {
    const cleaned = sanitizeBackendLog(text);
    if (!cleaned.trim()) return;
    setLogs((prev) => prev + cleaned);
  }, []);

  const persist = useCallback(async (partial: BackendSetupPersistState) => {
    persistRef.current = { ...persistRef.current, ...partial };
    await window.electron?.backendSetupApi?.({
      action: "writeState",
      state: persistRef.current,
    });
  }, []);

  const api = useCallback(
    async (
      payload: Parameters<NonNullable<typeof window.electron>["backendSetupApi"]>[0],
    ) => window.electron!.backendSetupApi(payload),
    [],
  );

  useEffect(() => {
    const offOutput = window.electron?.onBackendSetupOutput?.(({ text }) => {
      const url = parseLoginUrl(text);
      if (url) {
        setLoginUrl(url);
        if (openedLoginUrl.current !== url) {
          openedLoginUrl.current = url;
          openExternal(url);
        }
      }
      appendLog(text);
    });
    const offExit = window.electron?.onBackendSetupExit?.((data) => {
      const resolve = exitListeners.current.get(data.id);
      if (resolve) {
        exitListeners.current.delete(data.id);
        resolve(data);
      }
    });
    return () => {
      offOutput?.();
      offExit?.();
    };
  }, [appendLog]);

  useEffect(() => {
    if (!isElectron) {
      setReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const [saved, config, oauthConfig] = await Promise.all([
        api({ action: "readState" }),
        window.electron!.readFirebaseConfig(),
        window.electron!.readOauthConfig(),
      ]);
      if (cancelled) return;
      const state = (saved.state || {}) as BackendSetupPersistState;
      persistRef.current = state;
      if (state.token) setToken(state.token);
      if (state.projectId || config?.projectId) {
        setProjectId(state.projectId || config?.projectId || "");
      }
      setProjectDone(Boolean(state.configSaved || config));
      setConfigSaved(Boolean(state.configSaved || config));
      setBillingDone(Boolean(state.billingDone));
      setFirestoreDone(Boolean(state.firestoreDone));
      setAuthDone(Boolean(state.authDone));
      setDeployed(Boolean(state.deployed));
      setGoogleAuthNeedsConsole(Boolean(state.googleAuthNeedsConsole));
      setOauth(oauthStateFromConfig(oauthConfig));
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const runCommand = useCallback(
    async (args: string[]): Promise<ExitData> => {
      const { id } = await window.electron!.startBackendSetup(args, token);
      appendLog(`$ firebase ${args.join(" ")}\n`);
      return new Promise((resolve) => exitListeners.current.set(id, resolve));
    },
    [appendLog, token],
  );

  const startLogin = async (onSignedIn?: (accessToken: string) => Promise<void>) => {
    setRunning(true);
    setError("");
    try {
      const { id } = await window.electron!.startBackendSetup(["login:ci"]);
      loginIdRef.current = id;
      appendLog("Starting Google sign-in…\n");
      const data = await new Promise<ExitData>((resolve) =>
        exitListeners.current.set(id, resolve),
      );
      const parsedToken = parseLoginToken(data.output);
      if (data.code === 0 && parsedToken) {
        setToken(parsedToken);
        await persist({ token: parsedToken });
        await onSignedIn?.(parsedToken);
      } else {
        setError(data.error || "Sign-in failed. Try again.");
      }
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Could not start Google sign-in",
      );
    } finally {
      setRunning(false);
    }
  };

  const submitLoginCode = async () => {
    await window.electron!.writeBackendSetupInput(
      loginIdRef.current,
      `${loginCode.trim()}\n`,
    );
  };

  return {
    isElectron,
    logs,
    setLogs,
    error,
    setError,
    ready,
    running,
    setRunning,
    token,
    loginUrl,
    loginCode,
    setLoginCode,
    projectId,
    setProjectId,
    projectDone,
    setProjectDone,
    configSaved,
    setConfigSaved,
    billingDone,
    setBillingDone,
    firestoreDone,
    setFirestoreDone,
    authDone,
    setAuthDone,
    deployed,
    setDeployed,
    googleAuthNeedsConsole,
    setGoogleAuthNeedsConsole,
    oauth,
    setOauth,
    persist,
    api,
    runCommand,
    startLogin,
    submitLoginCode,
    appendLog,
  };
}
