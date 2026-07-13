import AppearanceSettings from "./AppearanceSettings";
import CustomDomainSettings from "./CustomDomainSettings";
import { CaptchaSection } from "./ExperimentSettings/components/CaptchaSection";
import { DataSettingsSection } from "./ExperimentSettings/components/DataSettingsSection";
import { RecruitmentSection } from "./ExperimentSettings/components/RecruitmentSection";
import { SessionNameSection } from "./ExperimentSettings/components/session-name/SessionNameSection";
import { useExperimentSettings } from "./ExperimentSettings/hooks/useExperimentSettings";

type ExperimentSettingsProps = {
  experimentID: string | undefined;
};

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
      <h2 style={{ color: "var(--text-dark)", marginBottom: 24, fontSize: 24 }}>
        Experiment Data Configuration
      </h2>
      <DataSettingsSection
        experimentExists={settings.experimentExists}
        config={settings.config}
        setConfig={settings.setConfig}
      />
      <SessionNameSection
        tokens={settings.sessionNameTokens}
        separator={settings.sessionNameSeparator}
        preview={settings.sessionNamePreview}
        saving={settings.saving}
        message={settings.sessionNameMessage}
        onAddToken={settings.addSessionToken}
        onRemoveToken={settings.removeSessionToken}
        onReorderToken={settings.reorderSessionToken}
        onUpdateToken={settings.updateSessionToken}
        onSeparatorChange={settings.setSessionNameSeparator}
        onSave={settings.handleSaveSessionName}
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
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button
              onClick={settings.handleSave}
              disabled={settings.saving}
              className="gradient-btn"
              style={{
                opacity: settings.saving ? 0.6 : 1,
                cursor: settings.saving ? "not-allowed" : "pointer",
              }}
            >
              {settings.saving ? "Saving..." : "Save Configuration"}
            </button>
            {settings.message && (
              <p
                style={{
                  color:
                    settings.message.type === "success" ? "#4caf50" : "#f44336",
                  fontWeight: "600",
                  fontSize: 14,
                }}
              >
                {settings.message.text}
              </p>
            )}
          </div>
        </>
      )}
      <AppearanceSettings experimentID={experimentID} />
      <CustomDomainSettings experimentID={experimentID} />
    </div>
  );
}

export default ExperimentSettings;
