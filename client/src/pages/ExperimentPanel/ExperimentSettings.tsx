import AppearanceSettings from "./AppearanceSettings";
import CustomDomainSettings from "./CustomDomainSettings";
import { CaptchaSection } from "./ExperimentSettings/components/CaptchaSection";
import { DataSettingsSection } from "./ExperimentSettings/components/DataSettingsSection";
import { RecruitmentSection } from "./ExperimentSettings/components/RecruitmentSection";
import { SessionNameSection } from "./ExperimentSettings/components/session-name/SessionNameSection";
import { useExperimentSettings } from "./ExperimentSettings/hooks/useExperimentSettings";

type ExperimentSettingsProps = { experimentID: string | undefined };

function ExperimentSettings({ experimentID }: ExperimentSettingsProps) {
  const settings = useExperimentSettings(experimentID);
  return (
    <div
      style={{
        marginTop: 24,
        padding: 32,
        backgroundColor: "var(--neutral-light)",
        borderRadius: 12,
        border: "1px solid var(--neutral-mid)",
      }}
    >
      <h2 style={{ color: "var(--text-dark)", marginBottom: 8, fontSize: 24 }}>
        Experiment Data Configuration
      </h2>
      <p>Changes apply the next time you publish.</p>
      {settings.loadError && (
        <div role="alert">
          <p>{settings.loadError}</p>
          <button type="button" onClick={settings.handleReload}>
            Retry
          </button>
        </div>
      )}
      {settings.needsReview && (
        <div role="status" style={{ marginBottom: 20 }}>
          <p>
            Review this experiment's configuration before publishing. Check the
            values below and confirm them.
          </p>
          {settings.deploymentReview?.required && (
            <ul>
              {settings.deploymentReview.reasons.map((reason, index) => (
                <li key={index}>{reason}</li>
              ))}
            </ul>
          )}
          {settings.settingsMigration?.state !== "complete" &&
            settings.settingsMigration?.source !== "package" && (
              <button
                type="button"
                disabled={settings.saving || settings.hasConflict}
                onClick={() => void settings.handleMigrate()}
              >
                Recover Published Settings
              </button>
            )}
        </div>
      )}
      <fieldset
        disabled={settings.saving || !settings.experimentExists}
        style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
      >
        <DataSettingsSection
          experimentExists={settings.experimentExists}
          config={settings.config}
          setConfig={settings.setConfig}
        />
        <SessionNameSection
          tokens={settings.sessionNameTokens}
          separator={settings.sessionNameSeparator}
          preview={settings.sessionNamePreview}
          message={settings.sessionNameMessage}
          onAddToken={settings.addSessionToken}
          onRemoveToken={settings.removeSessionToken}
          onReorderToken={settings.reorderSessionToken}
          onUpdateToken={settings.updateSessionToken}
          onSeparatorChange={settings.setSessionNameSeparator}
        />
        {settings.experimentExists && (
          <>
            <RecruitmentSection
              config={settings.recruitmentConfig}
              setConfig={settings.setRecruitmentConfig}
            />
            <CaptchaSection
              config={settings.captchaConfig}
              setConfig={settings.setCaptchaConfig}
            />
          </>
        )}
      </fieldset>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
        }}
      >
        <button
          type="button"
          className="gradient-btn"
          disabled={!settings.canSave}
          style={{
            opacity: settings.canSave ? 1 : 0.6,
            cursor: settings.canSave ? "pointer" : "not-allowed",
          }}
          onClick={() => void settings.handleSave()}
        >
          {settings.saving
            ? "Saving..."
            : settings.needsReview
              ? "Confirm and Save Configuration"
              : "Save Configuration"}
        </button>
        {settings.hasChanges && !settings.hasConflict && (
          <button
            type="button"
            disabled={settings.saving}
            onClick={settings.handleReload}
          >
            Discard Changes
          </button>
        )}
        {settings.hasConflict && (
          <button
            type="button"
            disabled={settings.saving}
            onClick={settings.handleReload}
          >
            Load Saved Version
          </button>
        )}
      </div>
      {settings.message &&
        (settings.message.type === "error" || !settings.hasChanges) && (
          <p
            role={settings.message.type === "error" ? "alert" : "status"}
            style={{
              color:
                settings.message.type === "success" ? "#4caf50" : "#f44336",
            }}
          >
            {settings.message.text}
          </p>
        )}
      <AppearanceSettings experimentID={experimentID} />
      <CustomDomainSettings experimentID={experimentID} />
    </div>
  );
}
export default ExperimentSettings;
