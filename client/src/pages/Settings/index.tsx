import { useNavigate } from "react-router";
import BackendSetup from "./BackendSetup";
import ResetAppButton from "./ResetAppButton";
import { AccountSettings } from "./components/AccountSettings";
import { BackupSection } from "./components/BackupSection";
import { ExportExperimentsModal } from "./components/ExportExperimentsModal";
import { ImportExperimentsModal } from "./components/ImportExperimentsModal";
import { useExperimentBackup } from "./hooks/useExperimentBackup";
import { useSettingsPage } from "./hooks/useSettingsPage";
import "./index.css";

export default function Settings() {
  const navigate = useNavigate();
  const {
    user,
    authLoading,
    notification,
    setNotification,
    experiments,
    isLoggingOut,
    handleLogout,
  } = useSettingsPage();
  const backup = useExperimentBackup({ experiments, setNotification });

  if (authLoading) {
    return (
      <div
        className="settings-bg"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <div style={{ color: "#3d92b4", fontSize: 18, fontWeight: 600 }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="settings-bg">
      <div
        style={{
          position: "fixed",
          top: 16,
          left: 16,
          zIndex: 1000,
          display: "flex",
          gap: "8px",
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: "6px 12px",
            borderRadius: 4,
            background: "#3d92b4",
            color: "white",
            border: "none",
            cursor: "pointer",
          }}
        >
          ←
        </button>
      </div>

      {backup.showExportModal && (
        <ExportExperimentsModal
          experiments={experiments}
          selectedExperimentIds={backup.selectedExperimentIds}
          isExporting={backup.isExporting}
          exportKind={backup.exportKind}
          onSelectionChange={backup.setSelectedExperimentIds}
          onClose={backup.closeExportModal}
          onExport={backup.handleExportSelected}
        />
      )}

      {backup.importPreview && (
        <ImportExperimentsModal
          preview={backup.importPreview}
          mode={backup.importMode}
          replaceExisting={backup.replaceExisting}
          busy={backup.isImporting}
          stale={backup.importStale}
          error={backup.importError}
          onModeChange={backup.setImportMode}
          onReplaceChange={backup.setReplaceExisting}
          onConfirm={backup.confirmImport}
          onCancel={backup.cancelImport}
          onInspectAgain={backup.inspectAgain}
        />
      )}

      <div className="settings-container">
        <h1 className="settings-title">Settings</h1>
        {notification && (
          <div className={`notification notification-${notification.type}`}>
            {notification.message}
            <button
              className="notification-close"
              onClick={() => setNotification(null)}
            >
              ×
            </button>
          </div>
        )}

        <BackupSection
          experiments={experiments}
          importInputRef={backup.importInputRef}
          isExporting={backup.isExporting}
          onImport={backup.handleImportZip}
          isImporting={backup.isImporting}
          exportKind={backup.exportKind}
          onExportKindChange={backup.setExportKind}
          onExportAll={backup.handleExportAll}
          onOpenExportModal={backup.openExportModal}
        />

        <div className="settings-section">
          <h2 className="settings-section-title">Server</h2>
          <BackendSetup />
        </div>

        {!user && (
          <div style={{ marginBottom: 24 }}>
            <ResetAppButton />
          </div>
        )}
        <AccountSettings
          user={user}
          isLoggingOut={isLoggingOut}
          onLogout={handleLogout}
          onLogin={() => navigate("/auth/login")}
        />
      </div>
    </div>
  );
}
