import { useCallback, useEffect, useRef, useState } from "react";
import { openExternal } from "../../lib/openExternal";
import {
  buildFirebaseConfig,
  buildFunctionsEnv,
  buildOauthConfig,
  OAUTH_CALLBACK_URI,
  parseCreatedAppId,
  parseLoginToken,
  parseLoginUrl,
  parseSdkConfig,
  PROVIDER_CONSOLE_URLS,
  PROVIDER_LABELS,
  type BackendOAuthState,
} from "../../lib/backendSetup";

const isElectron = !!window.electron?.startBackendSetup;

interface ExitData {
  id: string;
  code: number | null;
  error: string | null;
  output: string;
}

const EMPTY_OAUTH: BackendOAuthState = {
  github: { enabled: false, clientId: "", clientSecret: "" },
  dropbox: { enabled: false, clientId: "", clientSecret: "" },
  googleDrive: { enabled: false, clientId: "", clientSecret: "" },
  osf: { enabled: false, clientId: "", clientSecret: "" },
};

const PROVIDER_KEYS = Object.keys(EMPTY_OAUTH) as Array<
  keyof BackendOAuthState
>;

export default function BackendSetup() {
  const [logs, setLogs] = useState("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [token, setToken] = useState("");
  const [loginUrl, setLoginUrl] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [loginId, setLoginId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [projectMode, setProjectMode] = useState<"create" | "use">("create");
  const [projectDone, setProjectDone] = useState(false);
  const [blazeDone, setBlazeDone] = useState(false);
  const [firestoreDone, setFirestoreDone] = useState(false);
  const [authDone, setAuthDone] = useState(false);
  const [appName, setAppName] = useState("ExpBuilder");
  const [configSaved, setConfigSaved] = useState(false);
  const [oauth, setOauth] = useState<BackendOAuthState>(EMPTY_OAUTH);
  const [envSaved, setEnvSaved] = useState(false);
  const [deployed, setDeployed] = useState(false);

  const exitListeners = useRef<Map<string, (data: ExitData) => void>>(new Map());
  const loginIdRef = useRef("");

  useEffect(() => {
    const offOutput = window.electron?.onBackendSetupOutput?.(({ text }) => {
      setLogs((prev) => prev + text);
      const url = parseLoginUrl(text);
      if (url) {
        setLoginUrl(url);
      }
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
  }, []);

  const runCommand = useCallback(async (args: string[]): Promise<ExitData> => {
    const { id } = await window.electron!.startBackendSetup(args, token);
    setLogs((prev) => prev + `$ firebase ${args.join(" ")}\n`);
    return new Promise((resolve) => exitListeners.current.set(id, resolve));
  }, [token]);

  const startLogin = async () => {
    setRunning(true);
    setError("");
    try {
      const { id } = await window.electron!.startBackendSetup(["login:ci"]);
      loginIdRef.current = id;
      setLoginId(id);
      setLogs("$ firebase login:ci\n");
      const data = await new Promise<ExitData>((resolve) =>
        exitListeners.current.set(id, resolve),
      );
      const parsedToken = parseLoginToken(data.output);
      if (data.code === 0 && parsedToken) {
        setToken(parsedToken);
      } else {
        setError(
          data.error ||
            "Login failed. Check the log below and try again.",
        );
      }
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Failed to start the login flow",
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

  const handleProject = async () => {
    setRunning(true);
    setError("");
    try {
      const args = [
        "--project",
        projectId.trim(),
        ...(projectMode === "create" ? ["projects:create"] : []),
      ];
      const data = await runCommand(args);
      if (data.code === 0) {
        setProjectDone(true);
      } else {
        setError(
          data.error || "Project step failed. Check the log below.",
        );
      }
    } catch (projectError) {
      setError(
        projectError instanceof Error
          ? projectError.message
          : "Failed to run the project step",
      );
    } finally {
      setRunning(false);
    }
  };

  const openConsole = (path: string) => {
    const base = `https://console.firebase.google.com/project/${projectId}`;
    openExternal(`${base}${path}`);
  };

  const handleFirestore = async () => {
    setRunning(true);
    setError("");
    try {
      const data = await runCommand([
        "--project",
        projectId,
        "firestore:databases:create",
        "(default)",
        "--location",
        "nam5",
      ]);
      if (data.code === 0) {
        setFirestoreDone(true);
      } else {
        setError(
          data.error ||
            "Firestore creation failed. Check the log below.",
        );
      }
    } catch (firestoreError) {
      setError(
        firestoreError instanceof Error
          ? firestoreError.message
          : "Failed to create Firestore",
      );
    } finally {
      setRunning(false);
    }
  };

  const handleCreateApp = async () => {
    setRunning(true);
    setError("");
    try {
      const created = await runCommand([
        "--project",
        projectId,
        "apps:create",
        "web",
        appName.trim() || "ExpBuilder",
      ]);
      if (created.code !== 0) {
        setError(
          created.error ||
            "Web app creation failed. Check the log below.",
        );
        return;
      }
      const appId = parseCreatedAppId(created.output);
      if (!appId) {
        setError("Could not read the created app ID from the output.");
        return;
      }
      const sdkResult = await runCommand([
        "--project",
        projectId,
        "apps:sdkconfig",
        "web",
        appId,
      ]);
      if (sdkResult.code !== 0) {
        setError(
          sdkResult.error ||
            "Reading the Firebase SDK config failed. Check the log below.",
        );
        return;
      }
      const sdk = parseSdkConfig(sdkResult.output);
      const firebaseConfig = sdk ? buildFirebaseConfig(sdk) : null;
      if (!firebaseConfig) {
        setError("Could not parse the Firebase SDK config from the output.");
        return;
      }
      const saved = await window.electron!.writeFirebaseConfig(firebaseConfig);
      if (!saved.success) {
        setError(
          `Saving the Firebase config failed: ${saved.error || "Unknown error"}`,
        );
        return;
      }
      setConfigSaved(true);
    } catch (appError) {
      setError(
        appError instanceof Error ? appError.message : "Failed to create the web app",
      );
    } finally {
      setRunning(false);
    }
  };

  const handleSaveCredentials = async () => {
    setRunning(true);
    setError("");
    try {
      const env = buildFunctionsEnv(projectId, oauth);
      const savedEnv = await window.electron!.writeBackendEnv(env);
      if (!savedEnv.success) {
        setError(
          `Saving backend credentials failed: ${savedEnv.error || "Unknown error"}`,
        );
        return;
      }
      const oauthConfig = buildOauthConfig(oauth);
      const savedOauth = await window.electron!.writeOauthConfig(oauthConfig);
      if (!savedOauth.success) {
        setError(
          `Saving OAuth credentials failed: ${savedOauth.error || "Unknown error"}`,
        );
        return;
      }
      setEnvSaved(true);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to save credentials",
      );
    } finally {
      setRunning(false);
    }
  };

  const handleDeploy = async () => {
    setRunning(true);
    setError("");
    try {
      const data = await runCommand([
        "--project",
        projectId,
        "deploy",
        "--only",
        "firestore,functions",
      ]);
      if (data.code === 0) {
        setDeployed(true);
      } else {
        setError(
          data.error || "Deploy failed. Check the log below.",
        );
      }
    } catch (deployError) {
      setError(
        deployError instanceof Error ? deployError.message : "Failed to deploy",
      );
    } finally {
      setRunning(false);
    }
  };

  const toggleProvider = (key: keyof BackendOAuthState) => {
    setOauth((prev) => ({
      ...prev,
      [key]: { ...prev[key], enabled: !prev[key].enabled },
    }));
  };

  const updateProvider = (
    key: keyof BackendOAuthState,
    field: "clientId" | "clientSecret",
    value: string,
  ) => {
    setOauth((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  if (!isElectron) {
    return (
      <div
        style={{
          padding: "12px 16px",
          background: "#fff3cd",
          border: "1px solid #ffc107",
          borderRadius: 8,
          color: "#856404",
          fontSize: 14,
        }}
      >
        Backend setup is only available in the Electron app.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>
        Create and deploy your own Firebase backend from the app. You need a
        Google account and a credit card for the Blaze plan (usage stays free
        for light workloads).
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <button
          onClick={startLogin}
          disabled={running || !!token}
          className="token-button connect"
        >
          {token ? "Signed in" : "Sign in with Firebase"}
        </button>
        {loginUrl && !token && (
          <>
            <button
              onClick={() => openExternal(loginUrl)}
              className="token-button"
              style={{ background: "#3d92b4", color: "white" }}
            >
              Open login page
            </button>
            <input
              type="text"
              value={loginCode}
              onChange={(e) => setLoginCode(e.target.value)}
              placeholder="Paste the code from the browser"
              style={{ padding: "6px 10px", flex: 1 }}
            />
            <button
              onClick={submitLoginCode}
              disabled={!loginCode.trim()}
              className="token-button"
              style={{ background: "#6c757d", color: "white" }}
            >
              Submit code
            </button>
          </>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <select
          value={projectMode}
          onChange={(e) => setProjectMode(e.target.value as "create" | "use")}
          style={{ padding: "6px 10px" }}
        >
          <option value="create">Create new project</option>
          <option value="use">Use existing project</option>
        </select>
        <input
          type="text"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          placeholder="Firebase project ID"
          style={{ padding: "6px 10px", flex: 1 }}
        />
        <button
          onClick={handleProject}
          disabled={running || !token || !projectId.trim() || projectDone}
          className="token-button connect"
        >
          {projectDone ? "Project ready" : "Set project"}
        </button>
      </div>

      {projectDone && !configSaved && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
          <input
            type="text"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            placeholder="Web app display name"
            style={{ padding: "6px 10px", flex: 1 }}
          />
          <button
            onClick={handleCreateApp}
            disabled={running}
            className="token-button connect"
          >
            Create web app
          </button>
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => openConsole("/settings/usage")}
          disabled={!projectDone}
          className="token-button"
          style={{ background: "#3d92b4", color: "white" }}
        >
          Open Blaze billing page
        </button>
        <button
          onClick={() => setBlazeDone(true)}
          disabled={!projectDone || blazeDone || running}
          className="token-button connect"
        >
          {blazeDone ? "Blaze plan confirmed" : "I upgraded to Blaze"}
        </button>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={handleFirestore}
          disabled={!blazeDone || firestoreDone || running}
          className="token-button connect"
        >
          {firestoreDone ? "Firestore ready" : "Create Firestore database"}
        </button>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => openConsole("/authentication/providers")}
          disabled={!firestoreDone}
          className="token-button"
          style={{ background: "#3d92b4", color: "white" }}
        >
          Open Auth providers page
        </button>
        <button
          onClick={() => setAuthDone(true)}
          disabled={!firestoreDone || authDone || running}
          className="token-button connect"
        >
          {authDone
            ? "Sign-in providers confirmed"
            : "I enabled Email/Password and Google"}
        </button>
      </div>

      {authDone && (
        <div
          style={{
            background: "#f8f9fa",
            padding: 16,
            borderRadius: 8,
            border: "1px solid #dee2e6",
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>
            Create an OAuth app in each provider&apos;s console with this
            callback URI: <code>{OAUTH_CALLBACK_URI}</code>
          </div>
          {PROVIDER_KEYS.map((key) => (
            <div key={key} style={{ marginBottom: 10 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={oauth[key].enabled}
                  onChange={() => toggleProvider(key)}
                />
                <span style={{ fontWeight: 600, fontSize: 13 }}>
                  {PROVIDER_LABELS[key]}
                </span>
                <a
                  href={PROVIDER_CONSOLE_URLS[key]}
                  onClick={(e) => {
                    e.preventDefault();
                    openExternal(PROVIDER_CONSOLE_URLS[key]);
                  }}
                  style={{ fontSize: 12 }}
                >
                  open console
                </a>
              </label>
              {oauth[key].enabled && (
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <input
                    type="text"
                    value={oauth[key].clientId}
                    onChange={(e) =>
                      updateProvider(key, "clientId", e.target.value)
                    }
                    placeholder={`${PROVIDER_LABELS[key]} Client ID`}
                    style={{ padding: "6px 10px", flex: 1 }}
                  />
                  <input
                    type="text"
                    value={oauth[key].clientSecret}
                    onChange={(e) =>
                      updateProvider(key, "clientSecret", e.target.value)
                    }
                    placeholder={`${PROVIDER_LABELS[key]} Client Secret`}
                    style={{ padding: "6px 10px", flex: 1 }}
                  />
                </div>
              )}
            </div>
          ))}
          <button
            onClick={handleSaveCredentials}
            disabled={running || envSaved}
            className="token-button connect"
          >
            {envSaved ? "Credentials saved" : "Save backend credentials"}
          </button>
        </div>
      )}

      {envSaved && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <button
            onClick={handleDeploy}
            disabled={running || deployed}
            className="token-button connect"
          >
            {deployed ? "Backend deployed" : "Deploy backend"}
          </button>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: 4,
            background: "#ffebee",
            color: "#c62828",
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      <pre
        style={{
          background: "#1e1e1e",
          color: "#d4d4d4",
          padding: 12,
          borderRadius: 8,
          fontSize: 12,
          maxHeight: 260,
          overflow: "auto",
          whiteSpace: "pre-wrap",
        }}
      >
        {logs || "The command output will appear here."}
      </pre>
    </div>
  );
}
