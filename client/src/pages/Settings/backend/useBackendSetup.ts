import { useCallback, useEffect, useState } from "react";
import { openExternal } from "../../../lib/openExternal";
import { publishingSummary, setupStatus } from "../../../lib/backendCopy";
import {
  buildFunctionsEnv,
  buildOauthConfig,
  commandError,
  functionsDeployOnly,
  projectSetupArgs,
  publishingFingerprint,
  type BackendOAuthState,
  type BillingAccountOption,
  type FirebaseProjectOption,
} from "../../../lib/backendSetup";
import { createWebApp } from "./createWebApp";
import { provisionDatabase } from "./provisionDatabase";
import { useBackendSession } from "./useBackendSession";

export function useBackendSetup() {
  const session = useBackendSession();
  const {
    token,
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
    setAuthDone,
    deployed,
    setDeployed,
    setGoogleAuthNeedsConsole,
    oauth,
    setOauth,
    persist,
    api,
    runCommand,
    setError,
    setRunning,
    setLogs,
  } = session;

  const [projectMode, setProjectMode] = useState<"create" | "use">("create");
  const [projects, setProjects] = useState<FirebaseProjectOption[]>([]);
  const [billingAccounts, setBillingAccounts] = useState<BillingAccountOption[]>([]);
  const [selectedBilling, setSelectedBilling] = useState("");
  const [savedPublishing, setSavedPublishing] = useState<string | null>(null);
  const publishingKey = publishingFingerprint(oauth);
  const publishingDirty =
    savedPublishing === null ? false : publishingKey !== savedPublishing;

  const loadProjects = useCallback(
    async (accessToken: string) => {
      const result = await api({ action: "listProjects", token: accessToken });
      if (result.success) setProjects(result.projects || []);
    },
    [api],
  );

  const runDatabase = async (id: string, accessToken: string) =>
    provisionDatabase({
      projectId: id,
      token: accessToken,
      runCommand,
      api,
      setError,
      persist,
      setFirestoreDone,
      setAuthDone,
      setGoogleAuthNeedsConsole,
    });

  const refreshBilling = async (id: string, accessToken: string) => {
    const billing = await api({
      action: "checkBilling",
      token: accessToken,
      projectId: id,
    });
    if (billing.success && billing.enabled) {
      setBillingDone(true);
      await persist({
        projectId: id,
        configSaved: true,
        billingDone: true,
        token: accessToken,
      });
      await runDatabase(id, accessToken);
      return;
    }
    const listed = await api({
      action: "listBillingAccounts",
      token: accessToken,
      projectId: id,
    });
    const accounts = (listed.accounts || []).filter((account) => account.open !== false);
    setBillingAccounts(accounts);
    if (accounts.length === 1) setSelectedBilling(accounts[0].name);
    await persist({
      projectId: id,
      configSaved: true,
      billingDone: false,
      token: accessToken,
    });
  };

  const handleSetup = async () => {
    setRunning(true);
    setError("");
    const id = projectId.trim();
    try {
      if (!projectDone) {
        const args = projectSetupArgs(id, projectMode);
        if (args) {
          const data = await runCommand(args);
          if (data.code !== 0) {
            setError(commandError(data, "Could not set up the project. Try again."));
            return;
          }
        }
        setProjectDone(true);
      }
      if (!configSaved) {
        const created = await createWebApp({
          projectId: id,
          runCommand,
          setError,
        });
        if (!created) return;
        setConfigSaved(true);
      }
      await refreshBilling(id, token);
    } catch (setupError) {
      setError(
        setupError instanceof Error
          ? setupError.message
          : "Could not finish server setup.",
      );
    } finally {
      setRunning(false);
    }
  };

  const handleLinkBilling = async () => {
    setRunning(true);
    setError("");
    try {
      const result = await api({
        action: "linkBilling",
        token,
        projectId,
        billingAccountName: selectedBilling,
      });
      if (!result.success || !result.enabled) {
        setError(result.error || "Could not link the billing account. Try again.");
        return;
      }
      setBillingDone(true);
      await persist({ billingDone: true });
      await runDatabase(projectId, token);
    } finally {
      setRunning(false);
    }
  };

  const handleBillingContinue = async () => {
    setRunning(true);
    setError("");
    try {
      const billing = await api({ action: "checkBilling", token, projectId });
      if (billing.success && billing.enabled) {
        setBillingDone(true);
        await persist({ billingDone: true });
        await runDatabase(projectId, token);
        return;
      }
      setError("Google still needs a billing account. Add a card, then continue.");
    } finally {
      setRunning(false);
    }
  };

  const handleFirestore = async () => {
    setRunning(true);
    setError("");
    try {
      await runDatabase(projectId, token);
    } catch (firestoreError) {
      setError(
        firestoreError instanceof Error
          ? firestoreError.message
          : "Could not create the database.",
      );
    } finally {
      setRunning(false);
    }
  };

  const handleFinish = async () => {
    if (deployed && !publishingDirty) return;
    setRunning(true);
    setError("");
    setLogs("");
    try {
      const savedEnv = await window.electron!.writeBackendEnv(
        buildFunctionsEnv(projectId, oauth),
      );
      if (!savedEnv.success) {
        setError(
          `Could not save server credentials: ${savedEnv.error || "Unknown error"}`,
        );
        return;
      }
      const savedOauth = await window.electron!.writeOauthConfig(
        buildOauthConfig(oauth),
      );
      if (!savedOauth.success) {
        setError(
          `Could not save OAuth credentials: ${savedOauth.error || "Unknown error"}`,
        );
        return;
      }
      const data = await runCommand([
        "--project",
        projectId,
        "deploy",
        "--only",
        functionsDeployOnly(deployed),
      ]);
      if (data.code !== 0) {
        setError(commandError(data, "Could not deploy the server. Try again."));
        return;
      }
      setDeployed(true);
      setSavedPublishing(publishingFingerprint(oauth));
      await persist({ deployed: true });
    } catch (finishError) {
      setError(
        finishError instanceof Error ? finishError.message : "Could not finish setup.",
      );
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    if (token && !configSaved) void loadProjects(token);
  }, [token, configSaved, loadProjects]);

  useEffect(() => {
    if (!session.ready) return;
    setSavedPublishing((prev) =>
      prev === null ? publishingFingerprint(oauth) : prev,
    );
  }, [session.ready, oauth]);

  return {
    ...session,
    publishingNote: publishingSummary(oauth),
    status: setupStatus({
      deployed,
      running: session.running,
      firestoreDone,
      billingDone,
      configSaved,
      token,
      projectId,
    }),
    projectMode,
    setProjectMode,
    projects,
    billingAccounts,
    selectedBilling,
    setSelectedBilling,
    handleSetup,
    handleLinkBilling,
    handleBillingContinue,
    handleFirestore,
    handleFinish,
    publishingDirty,
    startLogin: () => session.startLogin(loadProjects),
    toggleProvider: (key: keyof BackendOAuthState) =>
      setOauth((prev) => ({
        ...prev,
        [key]: { ...prev[key], enabled: !prev[key].enabled },
      })),
    updateProvider: (
      key: keyof BackendOAuthState,
      field: "clientId" | "clientSecret",
      value: string,
    ) =>
      setOauth((prev) => ({
        ...prev,
        [key]: { ...prev[key], [field]: value },
      })),
    openConsole: (path: string) =>
      openExternal(`https://console.firebase.google.com/project/${projectId}${path}`),
    setProjectId,
  };
}
