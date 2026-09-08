interface SharedServerStatusProps {
  projectId: string;
  error: string;
  onError: (message: string) => void;
}

export default function SharedServerStatus({
  projectId,
  error,
  onError,
}: SharedServerStatusProps) {
  const handleDisconnect = async () => {
    if (!confirm("Disconnect this app from the shared server?")) return;

    const result = await window.electron!.deleteFirebaseConfig();
    if (!result.success) {
      onError(result.error || "The server could not be disconnected.");
      return;
    }

    void window.electron!.restartApp().catch(() => {});
  };

  return (
    <div className="backend-setup" style={{ marginTop: 8 }}>
      <p className="backend-status">Connected to {projectId}.</p>
      <p className="backend-copy">
        This app uses a shared server. You can sign in or create your own
        account.
      </p>
      <button
        type="button"
        onClick={handleDisconnect}
        className="token-button disconnect"
      >
        Disconnect
      </button>
      {error ? <div className="backend-error">{error}</div> : null}
    </div>
  );
}
