import { useState, type SetStateAction } from "react";
import {
  defaultFunctionalSettings,
  type FunctionalSettings,
  type SettingsSections,
} from "../../../../lib/functionalSettings";
import type { SessionNameToken, SessionNameTokenType } from "../types";
import {
  makeSessionToken,
  MAX_SESSION_TOKENS,
  previewToken,
} from "../utils/sessionName";

export type SessionNameConfig = {
  tokens: SessionNameToken[];
  separator: string;
};
export type SettingsDraft = SettingsSections & {
  sessionNameConfig: SessionNameConfig;
};
export function createSettingsDraft(
  settings?: FunctionalSettings | null,
  session?: Partial<SessionNameConfig> | null,
): SettingsDraft {
  const { batchConfig, recruitmentConfig, captchaConfig } =
    settings ?? defaultFunctionalSettings();
  return {
    batchConfig,
    recruitmentConfig,
    captchaConfig,
    sessionNameConfig: {
      tokens: session?.tokens ?? [],
      separator: session?.separator ?? "_",
    },
  };
}
const functionalKey = ({
  batchConfig,
  recruitmentConfig,
  captchaConfig,
}: SettingsDraft) =>
  JSON.stringify({ batchConfig, recruitmentConfig, captchaConfig });

export function useSettingsDraft() {
  const [draft, setDraft] = useState(createSettingsDraft);
  const [baseline, setBaseline] = useState<SettingsDraft | null>(null);
  const reset = (next: SettingsDraft, loaded = true) => {
    setDraft(next);
    setBaseline(loaded ? next : null);
  };
  const updateSection = <K extends keyof SettingsDraft>(
    key: K,
    value: SetStateAction<SettingsDraft[K]>,
  ) =>
    setDraft((previous) => ({
      ...previous,
      [key]:
        typeof value === "function"
          ? (value as (old: SettingsDraft[K]) => SettingsDraft[K])(
              previous[key],
            )
          : value,
    }));
  const setTokens = (value: SetStateAction<SessionNameToken[]>) =>
    setDraft((previous) => ({
      ...previous,
      sessionNameConfig: {
        ...previous.sessionNameConfig,
        tokens:
          typeof value === "function"
            ? value(previous.sessionNameConfig.tokens)
            : value,
      },
    }));
  const applyRecovered = (settings: FunctionalSettings) => {
    const { sessionNameConfig: _session, ...sections } =
      createSettingsDraft(settings);
    setDraft((previous) => ({ ...previous, ...sections }));
    setBaseline((previous) => previous && { ...previous, ...sections });
  };
  return {
    draft,
    reset,
    markSaved: setBaseline,
    applyRecovered,
    hasChanges:
      baseline !== null && JSON.stringify(draft) !== JSON.stringify(baseline),
    functionalChanges:
      baseline !== null && functionalKey(draft) !== functionalKey(baseline),
    config: draft.batchConfig,
    setConfig: (value: SetStateAction<SettingsDraft["batchConfig"]>) =>
      updateSection("batchConfig", value),
    recruitmentConfig: draft.recruitmentConfig,
    setRecruitmentConfig: (
      value: SetStateAction<SettingsDraft["recruitmentConfig"]>,
    ) => updateSection("recruitmentConfig", value),
    captchaConfig: draft.captchaConfig,
    setCaptchaConfig: (value: SetStateAction<SettingsDraft["captchaConfig"]>) =>
      updateSection("captchaConfig", value),
    sessionNameTokens: draft.sessionNameConfig.tokens,
    sessionNameSeparator: draft.sessionNameConfig.separator,
    setSessionNameSeparator: (separator: string) =>
      setDraft((previous) => ({
        ...previous,
        sessionNameConfig: { ...previous.sessionNameConfig, separator },
      })),
    sessionNamePreview: draft.sessionNameConfig.tokens
      .map(previewToken)
      .join(draft.sessionNameConfig.separator),
    addSessionToken: (type: SessionNameTokenType) =>
      setTokens((previous) =>
        previous.length >= MAX_SESSION_TOKENS
          ? previous
          : [...previous, makeSessionToken(type)],
      ),
    removeSessionToken: (id: string) =>
      setTokens((previous) => previous.filter((token) => token.id !== id)),
    reorderSessionToken: (from: number, to: number) =>
      setTokens((previous) => {
        if (from === to) return previous;
        const next = [...previous];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      }),
    updateSessionToken: (id: string, patch: Partial<SessionNameToken>) =>
      setTokens((previous) =>
        previous.map((token) =>
          token.id === id ? { ...token, ...patch } : token,
        ),
      ),
  };
}
