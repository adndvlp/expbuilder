import { useEffect, useState } from "react";
import { connectToSharedServer } from "../../../lib/serverConnection";

export default function SharedServerConnect() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [code, setCode] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const electronApi = window.electron;
    if (!electronApi?.readFirebaseConfig) return;
    electronApi
      .readFirebaseConfig()
      .then((config) => {
        if (!cancelled) setIsAvailable(!config);
      })
      .catch(() => {
        if (!cancelled) setIsAvailable(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isAvailable) return null;

  const handleConnect = async () => {
    setIsConnecting(true);
    setError("");
    setMessage("");
    try {
      const result = await connectToSharedServer(code);
      setMessage(
        result.restarting
          ? "Connected. ExpBuilder is restarting…"
          : "Connected. Close and reopen ExpBuilder to continue.",
      );
    } catch (connectError) {
      setError(
        connectError instanceof Error
          ? connectError.message
          : "The connection could not be saved.",
      );
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div
      data-testid="shared-server-connect"
      style={{
        padding: 16,
        marginBottom: 16,
        border: "1px solid #cfd8dc",
        borderRadius: 8,
        background: "#f7fbfc",
      }}
    >
      <h3 style={{ margin: "0 0 8px", fontSize: 17, color: "#333" }}>
        Connect to a shared server
      </h3>
      <p style={{ margin: "0 0 12px", fontSize: 14, color: "#555" }}>
        Paste the connection code you received.
      </p>
      <textarea
        aria-label="Connection code"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        placeholder="Paste connection code"
        rows={3}
        spellCheck={false}
        style={{
          width: "100%",
          padding: 10,
          border: "1px solid #b0bec5",
          borderRadius: 6,
          boxSizing: "border-box",
          resize: "vertical",
          fontFamily: "monospace",
          fontSize: 12,
        }}
      />
      <button
        type="button"
        onClick={handleConnect}
        disabled={isConnecting || !code.trim()}
        className="token-button connect"
        style={{ marginTop: 10 }}
      >
        {isConnecting ? "Connecting…" : "Connect"}
      </button>
      {error ? (
        <div
          role="alert"
          style={{ color: "#b42318", fontSize: 13, marginTop: 8 }}
        >
          {error}
        </div>
      ) : null}
      {message ? (
        <div
          role="status"
          style={{ color: "#1b7f3a", fontSize: 13, marginTop: 8 }}
        >
          {message}
        </div>
      ) : null}
    </div>
  );
}
