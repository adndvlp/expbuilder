import type { Dispatch, SetStateAction } from "react";
import type { MultiSessionConfig } from "../types";

interface MultiSessionSectionProps {
  config: MultiSessionConfig;
  setConfig: Dispatch<SetStateAction<MultiSessionConfig>>;
}

const fieldStyle = {
  padding: 12,
  fontSize: 16,
  border: "2px solid var(--neutral-mid)",
  borderRadius: 6,
  width: "120px",
  backgroundColor: "var(--neutral-light)",
  color: "var(--text-dark)",
} as const;

export function MultiSessionSection({
  config,
  setConfig,
}: MultiSessionSectionProps) {
  const remaining = Math.max(
    0,
    config.maxParticipantsPerExperiment % config.maxParticipantsPerBreakoutRoom,
  );

  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ color: "var(--text-dark)", marginBottom: 8, fontSize: 24 }}>
        Multi-Session
      </h2>
      <p
        style={{
          color: "var(--text-dark)",
          fontSize: 14,
          opacity: 0.8,
          marginBottom: 16,
        }}
      >
        Allow multiple participants to connect in the same session. Responses are
        shared between participants in real time, enabling negotiation, bidding,
        and other interactive multiplayer tasks. Participants are split into
        breakout rooms based on connection order.
      </p>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <input
          type="checkbox"
          id="multiSessionEnabled"
          checked={config.enabled}
          onChange={(event) =>
            setConfig({ ...config, enabled: event.target.checked })
          }
          style={{ width: 20, height: 20, cursor: "pointer" }}
        />
        <label
          htmlFor="multiSessionEnabled"
          style={{
            fontSize: 16,
            fontWeight: "600",
            color: "var(--text-dark)",
            cursor: "pointer",
          }}
        >
          Enable Multi-Session
        </label>
      </div>

      {config.enabled && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            marginTop: 4,
          }}
        >
          <div>
            <label
              htmlFor="maxParticipantsExperiment"
              style={{
                display: "block",
                fontSize: 16,
                fontWeight: "600",
                color: "var(--text-dark)",
                marginBottom: 8,
              }}
            >
              Maximum participants per experiment
            </label>
            <input
              type="number"
              id="maxParticipantsExperiment"
              min={2}
              value={config.maxParticipantsPerExperiment}
              onChange={(event) => {
                const value = parseInt(event.target.value) || 2;
                setConfig({
                  ...config,
                  maxParticipantsPerExperiment: Math.max(2, value),
                });
              }}
              style={fieldStyle}
            />
            <p
              style={{
                marginTop: 8,
                color: "var(--text-dark)",
                fontSize: 14,
                opacity: 0.8,
              }}
            >
              Total number of participants that can join this experiment (minimum
              2).
            </p>
          </div>

          <div>
            <label
              htmlFor="maxParticipantsBreakout"
              style={{
                display: "block",
                fontSize: 16,
                fontWeight: "600",
                color: "var(--text-dark)",
                marginBottom: 8,
              }}
            >
              Maximum participants per breakout room
            </label>
            <input
              type="number"
              id="maxParticipantsBreakout"
              min={2}
              value={config.maxParticipantsPerBreakoutRoom}
              onChange={(event) => {
                const value = parseInt(event.target.value) || 2;
                setConfig({
                  ...config,
                  maxParticipantsPerBreakoutRoom: Math.max(2, value),
                });
              }}
              style={fieldStyle}
            />
            <p
              style={{
                marginTop: 8,
                color: "var(--text-dark)",
                fontSize: 14,
                opacity: 0.8,
              }}
            >
              Number of participants grouped together in each room (minimum 2).
            </p>
          </div>

          <div
            style={{
              padding: 16,
              backgroundColor: "var(--neutral-mid)",
              borderRadius: 8,
              border: "1px solid var(--neutral-mid)",
            }}
          >
            <p
              style={{
                color: "var(--text-dark)",
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              Room distribution preview
            </p>
            {config.maxParticipantsPerExperiment <= 0 ||
            config.maxParticipantsPerBreakoutRoom <= 0 ? (
              <p
                style={{
                  color: "var(--text-dark)",
                  fontSize: 14,
                  opacity: 0.8,
                }}
              >
                Enter valid values above to see the room distribution.
              </p>
            ) : (
              <>
                <p
                  style={{
                    color: "var(--text-dark)",
                    fontSize: 14,
                    opacity: 0.8,
                    marginBottom: 4,
                  }}
                >
                  {config.maxParticipantsPerExperiment} participants split into{" "}
                  {Math.ceil(
                    config.maxParticipantsPerExperiment /
                      config.maxParticipantsPerBreakoutRoom,
                  )}{" "}
                  rooms of up to {config.maxParticipantsPerBreakoutRoom} each.
                </p>
                {remaining > 0 && (
                  <p
                    style={{
                      color: "var(--text-dark)",
                      fontSize: 14,
                      opacity: 0.8,
                      fontStyle: "italic",
                    }}
                  >
                    One room will have{" "}
                    {config.maxParticipantsPerBreakoutRoom - remaining} fewer
                    participants. The experiment starts even if not all rooms are
                    full.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
