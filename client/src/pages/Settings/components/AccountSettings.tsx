import type { User } from "firebase/auth";
import ChangePassword from "../ChangePassword";
import DeleteAccount from "../DeleteAccount";
import DropboxToken from "../Dropbox/DropboxToken";
import GithubToken from "../Github/GithubToken";
import GoogleDriveToken from "../GoogleDrive/GoogleDriveToken";
import OsfToken from "../OsfToken";
import ResetAppButton from "../ResetAppButton";

interface AccountSettingsProps {
  user: User | null;
  isLoggingOut: boolean;
  onLogout: () => void;
  onLogin: () => void;
}

export function AccountSettings({
  user,
  isLoggingOut,
  onLogout,
  onLogin,
}: AccountSettingsProps) {
  const lockedStyle = !user
    ? { filter: "blur(4px)", pointerEvents: "none" as const }
    : {};

  return (
    <div style={{ position: "relative" }}>
      <div className="settings-section account-info" style={lockedStyle}>
        <h2 className="settings-section-title">Account Information</h2>
        <div className="account-info-item">
          <strong>Email:</strong> {user?.email}
        </div>
        <div className="account-info-item">
          <strong>UID:</strong> {user?.uid}
        </div>
      </div>

      <div className="settings-section" style={lockedStyle}>
        <h2 className="settings-section-title">Integration Tokens</h2>
        <div className="tokens-list">
          <GoogleDriveToken />
          <DropboxToken />
          <GithubToken />
          <OsfToken />
        </div>
      </div>

      <div className="settings-section" style={lockedStyle}>
        <h2 className="settings-section-title">Security</h2>
        <ChangePassword />
      </div>

      <div className="settings-section logout-section" style={lockedStyle}>
        <h2 className="settings-section-title">Session</h2>
        <button
          onClick={onLogout}
          disabled={isLoggingOut}
          className="logout-button"
        >
          {isLoggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>

      <div
        className="settings-section logout-section"
        style={
          !user ? { filter: "blur(1px)", pointerEvents: "none" as const } : {}
        }
      >
        <h2 className="settings-section-title">Danger Zone</h2>
        <DeleteAccount />
        {user && <ResetAppButton />}
      </div>

      {!user && <LoginRequiredOverlay onLogin={onLogin} />}
    </div>
  );
}

function LoginRequiredOverlay({ onLogin }: { onLogin: () => void }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(255,255,255,0.3)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          background: "#fffbe6",
          color: "#b7950b",
          padding: "32px 40px",
          borderRadius: 12,
          boxShadow: "0 4px 24px rgba(183,149,11,0.12)",
          fontSize: 22,
          fontWeight: 700,
          marginBottom: 24,
          textAlign: "center",
          border: "2px solid #b7950b",
          maxWidth: 400,
        }}
      >
        You need an account to access these settings.
        <button
          onClick={onLogin}
          style={{
            marginTop: 24,
            padding: "12px 32px",
            borderRadius: 8,
            background: "#b7950b",
            color: "white",
            border: "none",
            fontWeight: 700,
            fontSize: 18,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(183,149,11,0.12)",
            transition: "background 0.2s ease",
          }}
        >
          Go to Login
        </button>
      </div>
    </div>
  );
}
