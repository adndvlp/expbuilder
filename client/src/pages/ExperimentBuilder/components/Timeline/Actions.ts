import { Dispatch, SetStateAction, useEffect } from "react";
import useDevMode from "../../hooks/useDevMode";
import { getApiBaseUrl } from "../../../../lib/apiBaseUrl";
import {
  ArtifactBuildError,
  buildExperimentArtifact,
} from "../../modules/experiment-runtime/experimentArtifact";
const API_URL = getApiBaseUrl();

type Props = {
  experimentID: string | undefined;
  lastPagesUrl: string;
  isTunnelActive: boolean;
  setIsSubmitting: Dispatch<SetStateAction<boolean>>;
  generateLocalExperiment: () => Promise<string>;
  generatedBaseCode: () => Promise<string>;
  setSubmitStatus: Dispatch<SetStateAction<string>>;
  setExperimentUrl: (url: string) => void;
  setTunnelCopyStatus: Dispatch<SetStateAction<string>>;
  setPagesCopyStatus: Dispatch<SetStateAction<string>>;
  setTunnelStatus: Dispatch<SetStateAction<string>>;
  setTunnelActive: Dispatch<SetStateAction<boolean>>;
  setIsTunnelCreating: Dispatch<SetStateAction<boolean>>;
  setActiveTunnelUrl: Dispatch<SetStateAction<string>>;
  setLastPagesUrl: Dispatch<SetStateAction<string>>;
};

export default function Actions({
  experimentID,
  lastPagesUrl,
  isTunnelActive,
  setIsSubmitting,
  generateLocalExperiment,
  generatedBaseCode,
  setSubmitStatus,
  setExperimentUrl,
  setTunnelCopyStatus,
  setPagesCopyStatus,
  setTunnelStatus,
  setTunnelActive,
  setIsTunnelCreating,
  setActiveTunnelUrl,
  setLastPagesUrl,
}: Props) {
  const { isDevMode, setCode } = useDevMode();
  const handleRunExperiment = async () => {
    setIsSubmitting(true);

    try {
      const generatedLocalCode = await generateLocalExperiment();

      if (!isDevMode) {
        setSubmitStatus("Saving configuration...");

        setCode(await generatedBaseCode());

      }

      await buildExperimentArtifact({
        experimentId: experimentID,
        generatedCode: generatedLocalCode,
        apiBaseUrl: API_URL,
        saveConfiguration: !isDevMode,
        isDevMode,
        onStage: (stage) =>
          setSubmitStatus(
            stage === "saving"
              ? "Saving configuration..."
              : "Running experiment...",
          ),
      });
      setSubmitStatus("Experiment ready!");
      setSubmitStatus("");
    } catch (error) {
      console.error("Error submitting configuration:", error);
      if (
        error instanceof ArtifactBuildError &&
        error.reason === "rejected"
      ) {
        const message =
          error.stage === "saving"
            ? "Failed to save configuration."
            : "Saved configuration but failed at running the experiment.";
        setSubmitStatus(message);
        if (error.stage === "building") window.alert(message);
        return;
      }
      setSubmitStatus(
        `An error occurred: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    } finally {
      setIsSubmitting(false);
      // console.log(generateExperiment());
    }
  };

  const handleShareLocalExperiment = async () => {
    const confirm = window.confirm(
      "Warning: All your local experiments will be public until you close the tunnel or exit the app. Anyone with a link can access them.",
    );
    if (!confirm) return;
    setIsTunnelCreating(true);

    // Hostname is resolved server-side from the experiment's tunnel settings
    try {
      const res = await fetch(`${API_URL}/api/create-tunnel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experimentID }),
      });

      const data = await res.json();
      if (data.success) {
        setExperimentUrl(`${data.url}/${experimentID}`);
        setActiveTunnelUrl(data.url);
        // Persist tunnel state in localStorage (global, not per experiment)
        localStorage.setItem("tunnelActive", "true");
        localStorage.setItem("tunnelUrl", data.url);
        const url = `${data.url}/${experimentID}`;
        try {
          await navigator.clipboard.writeText(url);
          setTunnelStatus("Tunnel active — link copied to clipboard");
        } catch (err) {
          console.error("Failed to copy public link: ", err);
          setTunnelStatus("Tunnel active");
        }
        setTunnelActive(true);
        setTimeout(() => setTunnelStatus(""), 4000);
        return url;
      } else {
        console.error("Error creating tunnel:", data.error);
        setTunnelStatus(`Failed: ${data.error || "Unknown error"}`);
        setTimeout(() => setTunnelStatus(""), 5000);
      }
    } catch (error) {
      console.error("Connection error:", error);
      setTunnelStatus(
        `Connection error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      setTimeout(() => setTunnelStatus(""), 5000);
    } finally {
      setIsTunnelCreating(false);
    }
  };

  const handleCloseTunnel = async () => {
    const confirm = window.confirm(
      "Stop sharing your local experiment? Participants won't be able to access it until you reopen the tunnel. Collected results will not be lost.",
    );
    if (!confirm) return;
    try {
      const res = await fetch(`${API_URL}/api/close-tunnel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experimentID }),
      });
      const data = await res.json();

      setExperimentUrl(`${API_URL}/${experimentID}`);
      setActiveTunnelUrl("");
      setTunnelActive(false);
      localStorage.removeItem("tunnelActive");
      localStorage.removeItem("tunnelUrl");
      if (data.success) {
        setTunnelStatus(data.message);
      } else {
        setTunnelStatus("Error closing tunnel");
        console.error(data.message);
      }
      setTimeout(() => setTunnelStatus(""), 2000);
    } catch (err) {
      console.error("Error closing tunnel:", err);
    }
  };
  // Restore tunnel state and load saved URLs from DB on mount
  useEffect(() => {
    const tunnelActive = localStorage.getItem("tunnelActive") === "true";
    const tunnelUrl = localStorage.getItem("tunnelUrl");
    if (tunnelActive && tunnelUrl) {
      setTunnelActive(true);
      setExperimentUrl(`${tunnelUrl}/${experimentID}`);
    }
    if (!experimentID) return;
    fetch(`${API_URL}/api/experiment/${experimentID}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.experiment) {
          if (data.experiment.tunnelUrl) {
            setActiveTunnelUrl(data.experiment.tunnelUrl);
          } else {
            // Server restarted — tunnel is gone, clear stale state
            setActiveTunnelUrl("");
            setTunnelActive(false);
            localStorage.removeItem("tunnelActive");
            localStorage.removeItem("tunnelUrl");
          }
          if (data.experiment.pagesUrl) {
            setLastPagesUrl(data.experiment.pagesUrl);
          }
        }
      })
      .catch(console.error);
  }, [
    experimentID,
    setExperimentUrl,
    setActiveTunnelUrl,
    setLastPagesUrl,
    setTunnelActive,
  ]);

  const handleCopyLink = async () => {
    let linkToCopy = "";
    // Prioridad: el último link publicado (GitHub Pages) si existe
    if (lastPagesUrl) {
      linkToCopy = lastPagesUrl;
    } else if (isTunnelActive && experimentID) {
      const tunnelUrl = localStorage.getItem("tunnelUrl");
      if (tunnelUrl) {
        linkToCopy = `${tunnelUrl}/${experimentID}`;
      }
    }
    const setter = lastPagesUrl ? setPagesCopyStatus : setTunnelCopyStatus;
    if (linkToCopy) {
      try {
        await navigator.clipboard.writeText(linkToCopy);
        setter("Link copied!");
        setTimeout(() => setter(""), 2000);
      } catch (err) {
        console.error("Failed to copy: ", err);
        setter("Failed to copy link.");
      }
    } else {
      setter("No published link available.");
      setTimeout(() => setter(""), 2000);
    }
  };
  return {
    handleRunExperiment,
    handleShareLocalExperiment,
    handleCloseTunnel,
    handleCopyLink,
  };
}
