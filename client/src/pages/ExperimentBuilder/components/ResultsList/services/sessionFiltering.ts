import { Filters, SessionMeta, TabType } from "../types";

export function getFilterOptions(sessions: SessionMeta[]) {
  const compact = (values: Array<string | undefined>) => [
    ...new Set(values.filter((value): value is string => !!value)),
  ];
  return {
    browsers: compact(sessions.map((session) => session.metadata?.browser)),
    operatingSystems: compact(sessions.map((session) => session.metadata?.os)),
    resolutions: compact(
      sessions.map((session) => session.metadata?.screenResolution),
    ),
  };
}

export function filterSessions(
  sessions: SessionMeta[],
  filters: Filters,
): SessionMeta[] {
  return sessions.filter((session) => {
    if (filters.state && session.state !== filters.state) return false;
    if (filters.browser && session.metadata?.browser !== filters.browser) {
      return false;
    }
    if (filters.os && session.metadata?.os !== filters.os) return false;
    if (
      filters.resolution &&
      session.metadata?.screenResolution !== filters.resolution
    ) {
      return false;
    }
    if (!filters.datePeriod) return true;

    const now = new Date();
    const created = new Date(session.createdAt).getTime();
    const startOf = (date: Date) => {
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    };
    if (filters.datePeriod === "today") {
      return created >= startOf(new Date(now));
    }
    if (filters.datePeriod === "yesterday") {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return created >= startOf(yesterday) && created < startOf(new Date(now));
    }
    const periods: Record<string, number> = {
      "7d": 7,
      "30d": 30,
      "90d": 90,
    };
    return created >= now.getTime() - periods[filters.datePeriod] * 86400000;
  });
}

export function getResultsTitle(activeTab: TabType): string {
  if (activeTab === "preview") return "Preview Results";
  if (activeTab === "local") return "Local Experiment Sessions";
  return "Online Experiment Sessions";
}

export function getEmptyMessage(activeTab: TabType): string {
  if (activeTab === "preview") return "There are no preview results.";
  if (activeTab === "local") {
    return "There are no local experiment sessions.";
  }
  return "There are no online experiment sessions.";
}
