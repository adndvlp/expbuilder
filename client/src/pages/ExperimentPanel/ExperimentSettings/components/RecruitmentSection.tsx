import type { Dispatch, SetStateAction } from "react";
import type { RecruitmentConfig, RecruitmentPlatform } from "../types";

interface RecruitmentSectionProps {
  config: RecruitmentConfig;
  setConfig: Dispatch<SetStateAction<RecruitmentConfig>>;
}

export function RecruitmentSection({
  config,
  setConfig,
}: RecruitmentSectionProps) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ color: "var(--text-dark)", marginBottom: 24, fontSize: 24 }}>
        Recruitment Platform
      </h2>
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        {(["none", "prolific", "mturk"] as RecruitmentPlatform[]).map(
          (platform) => (
            <button
              key={platform}
              onClick={() => setConfig({ ...config, platform })}
              style={{
                padding: "8px 20px",
                borderRadius: 6,
                border: "2px solid",
                borderColor:
                  config.platform === platform
                    ? "var(--primary-blue)"
                    : "var(--neutral-mid)",
                backgroundColor:
                  config.platform === platform
                    ? "var(--primary-blue)"
                    : "transparent",
                color:
                  config.platform === platform
                    ? "var(--text-light)"
                    : "var(--text-dark)",
                fontWeight: 600,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {platform === "none"
                ? "None"
                : platform === "prolific"
                  ? "Prolific"
                  : "MTurk"}
            </button>
          ),
        )}
      </div>

      {config.platform === "prolific" && (
        <div
          style={{
            padding: 16,
            border: "1px solid var(--neutral-mid)",
            borderRadius: 8,
            marginTop: 12,
          }}
        >
          <p
            style={{
              color: "var(--text-dark)",
              fontSize: 14,
              marginBottom: 12,
              opacity: 0.8,
            }}
          >
            Prolific will append <code>?PROLIFIC_PID=...</code>&amp;
            <code>STUDY_ID=...</code>&amp;<code>SESSION_ID=...</code> to your
            experiment URL automatically. Paste the{" "}
            <strong>completion code</strong> provided by Prolific when creating
            their study.
          </p>
          <label
            htmlFor="prolificCode"
            style={{
              display: "block",
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text-dark)",
              marginBottom: 6,
            }}
          >
            Prolific Completion Code
          </label>
          <input
            id="prolificCode"
            type="text"
            placeholder="e.g. C1A2B3C4"
            value={config.prolificCompletionCode}
            onChange={(event) =>
              setConfig({
                ...config,
                prolificCompletionCode: event.target.value,
              })
            }
            style={{
              padding: 10,
              fontSize: 15,
              border: "2px solid var(--neutral-mid)",
              borderRadius: 6,
              width: "280px",
              backgroundColor: "var(--neutral-light)",
              color: "var(--text-dark)",
            }}
          />
          <p
            style={{
              marginTop: 8,
              fontSize: 13,
              color: "var(--text-dark)",
              opacity: 0.7,
            }}
          >
            On <code>on_finish</code>, participants will be redirected to{" "}
            <code>
              https://app.prolific.com/submissions/complete?cc=&#123;code&#125;
            </code>
          </p>
        </div>
      )}

      {config.platform === "mturk" && (
        <div
          style={{
            padding: 16,
            border: "1px solid var(--neutral-mid)",
            borderRadius: 8,
            marginTop: 12,
          }}
        >
          <p style={{ color: "var(--text-dark)", fontSize: 14, opacity: 0.8 }}>
            MTurk will append <code>?workerId=...</code>&amp;
            <code>assignmentId=...</code>&amp;<code>hitId=...</code>&amp;
            <code>turkSubmitTo=...</code> to your experiment URL when loading it
            inside a HIT. On <code>on_finish</code>, a form will be submitted to
            Amazon automatically. If{" "}
            <code>assignmentId=ASSIGNMENT_ID_NOT_AVAILABLE</code> (preview
            mode), the experiment will show a message instead of starting.
          </p>
        </div>
      )}
    </div>
  );
}
