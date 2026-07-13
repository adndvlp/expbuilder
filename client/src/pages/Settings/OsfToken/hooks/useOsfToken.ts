import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../../../lib/firebase";
import { fetchOAuthState } from "../../../../lib/oauthState";
import { openExternal } from "../../../../lib/openExternal";
import {
  getOsfManageUrl,
  getOsfOAuthExchangeUrl,
  getOsfRedirectUri,
} from "../utils/osfUrls";

const isElectron = !!window.electron?.startOAuthFlow;
const CLIENT_ID = "ee4514d3235d4acb8da4443b3516ede2";

export function useOsfToken() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [projectIdInput, setProjectIdInput] = useState("");
  const [error, setError] = useState("");
  const [osfUserName, setOsfUserName] = useState("");
  const [osfProjectId, setOsfProjectId] = useState("");
  const user = auth.currentUser;
  const redirectUri = getOsfRedirectUri(
    isElectron,
    import.meta.env.DEV,
    import.meta.env.VITE_OSF_OAUTH_CALLBACK_URL,
  );

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    const loadTokenStatus = async () => {
      try {
        const snapshot = await getDoc(doc(db, "users", user.uid));
        if (snapshot.exists()) {
          const data = snapshot.data();
          setHasToken(
            !!data.osfTokens?.access_token ||
              (!!data.osfToken && data.osfTokenValid),
          );
          setOsfUserName(data.osfUserName || "");
          setOsfProjectId(data.osfProjectId || "");
        }
      } catch (loadError) {
        console.error("Error loading token status:", loadError);
      } finally {
        setIsLoading(false);
      }
    };
    void loadTokenStatus();
  }, [user]);

  const buildOAuthUrl = (state: string) =>
    `https://accounts.osf.io/oauth2/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&scope=${encodeURIComponent(
      "osf.full_read osf.full_write",
    )}&access_type=offline&approval_prompt=auto&state=${encodeURIComponent(state)}`;

  const handleConnectOAuth = async (retryAttempt = 0): Promise<void> => {
    if (!user) return;
    let signedState: string;
    try {
      signedState = await fetchOAuthState("osf");
    } catch (stateError: unknown) {
      console.error("Failed to obtain OAuth state:", stateError);
      const message = (stateError as { message?: string }).message;
      setError(`Could not start OAuth flow: ${message}`);
      return;
    }

    if (!isElectron) {
      openExternal(buildOAuthUrl(signedState));
      return;
    }
    setIsConnecting(true);
    if (retryAttempt === 0) {
      setError(
        "Opening OSF authorization... If it fails, it will retry automatically.",
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    try {
      const result = await window.electron!.startOAuthFlow({
        provider: "osf",
        clientId: CLIENT_ID,
        scope: "osf.full_read osf.full_write",
        state: signedState,
      });
      if (result.success) {
        const functionUrl = getOsfOAuthExchangeUrl(
          import.meta.env.DEV,
          result.code!,
          result.state!,
          "http://localhost:8888/callback",
        );
        const response = await fetch(functionUrl);
        if (!response.ok && !response.redirected) {
          throw new Error("Failed to exchange tokens");
        }
        const snapshot = await getDoc(doc(db, "users", user.uid));
        if (snapshot.exists()) {
          const data = snapshot.data();
          setHasToken(!!data.osfTokens?.access_token);
          setOsfUserName(data.osfUserName || "");
          setOsfProjectId(data.osfProjectId || "");
        }
        alert("OSF connected successfully via OAuth!");
      } else {
        if (result.error?.includes("invalid_client") && retryAttempt < 2) {
          setError(
            `OSF configuration is propagating... Retrying (attempt ${retryAttempt + 2}/3)`,
          );
          await new Promise((resolve) => setTimeout(resolve, 3000));
          return handleConnectOAuth(retryAttempt + 1);
        }
        throw new Error(result.error || "OAuth flow failed");
      }
    } catch (connectError: unknown) {
      console.error("Error connecting OSF:", connectError);
      const message = (connectError as { message?: string }).message;
      setError(
        message?.includes("invalid_client")
          ? "OSF OAuth configuration error. Please ensure your application is properly configured at https://osf.io/settings/applications/ and try again in a few seconds."
          : `Connection failed: ${message}`,
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSaveToken = async () => {
    if (!user || !tokenInput.trim()) {
      setError("Please enter a valid token");
      return;
    }
    if (!projectIdInput.trim()) {
      setError("Please enter a valid OSF Project ID");
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      const response = await fetch(getOsfManageUrl(import.meta.env.DEV), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "saveToken",
          uid: user.uid,
          token: tokenInput,
          projectId: projectIdInput,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setHasToken(true);
        setOsfUserName(data.userName || "");
        setOsfProjectId(projectIdInput);
        setShowTokenInput(false);
        setTokenInput("");
        setProjectIdInput("");
        alert("OSF token saved successfully!");
      } else {
        setError(data.message || "Failed to save token");
      }
    } catch (saveError) {
      console.error("Error saving OSF token:", saveError);
      setError(
        saveError instanceof Error ? saveError.message : "Error saving token",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteToken = async () => {
    if (
      !confirm(
        "Are you sure you want to disconnect OSF? This will remove your token.",
      )
    ) {
      return;
    }
    setIsDeleting(true);
    try {
      const response = await fetch(getOsfManageUrl(import.meta.env.DEV), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect", uid: user!.uid }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || "Failed to disconnect");
      }
      setHasToken(false);
      setOsfUserName("");
      setOsfProjectId("");
      alert("OSF disconnected successfully!");
    } catch (deleteError) {
      console.error("Error deleting OSF token:", deleteError);
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : "Error disconnecting OSF";
      alert(`Error: ${message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelManualToken = () => {
    setShowTokenInput(false);
    setTokenInput("");
    setProjectIdInput("");
    setError("");
  };

  return {
    isDeleting,
    isSaving,
    isConnecting,
    hasToken,
    isLoading,
    showTokenInput,
    tokenInput,
    projectIdInput,
    error,
    osfUserName,
    osfProjectId,
    setShowTokenInput,
    setTokenInput,
    setProjectIdInput,
    setError,
    handleConnectOAuth,
    handleSaveToken,
    handleDeleteToken,
    cancelManualToken,
  };
}
