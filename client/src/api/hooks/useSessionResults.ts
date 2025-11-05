import { useCallback, useEffect, useState } from "react";
import {
  createSessionResult,
  appendSessionResult,
  getSessionResults,
  getSessionData,
  deleteSessionResult,
  SessionResult,
} from "../sessionResults";

export function useSessionResults(experimentID: string) {
  const [sessions, setSessions] = useState<Omit<SessionResult, "data">[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSessionResults(experimentID);
      setSessions(data);
    } catch (err: any) {
      setError(err.message || "Error loading sessions");
    } finally {
      setLoading(false);
    }
  }, [experimentID]);

  const create = useCallback(
    async (sessionId: string) => {
      setLoading(true);
      setError(null);
      try {
        return await createSessionResult(experimentID, sessionId);
      } catch (err: any) {
        setError(err.message || "Error creating session");
        return { success: false, error: err.message };
      } finally {
        setLoading(false);
      }
    },
    [experimentID]
  );

  const append = useCallback(
    async (sessionId: string, response: any) => {
      setLoading(true);
      setError(null);
      try {
        return await appendSessionResult(experimentID, sessionId, response);
      } catch (err: any) {
        setError(err.message || "Error appending result");
        return { success: false, error: err.message };
      } finally {
        setLoading(false);
      }
    },
    [experimentID]
  );

  const remove = useCallback(
    async (sessionId: string) => {
      setLoading(true);
      setError(null);
      try {
        const ok = await deleteSessionResult(experimentID, sessionId);
        if (ok)
          setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
        return ok;
      } catch (err: any) {
        setError(err.message || "Error deleting session");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [experimentID]
  );

  const getData = useCallback(
    async (sessionId: string) => {
      setLoading(true);
      setError(null);
      try {
        return await getSessionData(experimentID, sessionId);
      } catch (err: any) {
        setError(err.message || "Error getting session data");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [experimentID]
  );

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return {
    sessions,
    loading,
    error,
    fetchSessions,
    create,
    append,
    remove,
    getData,
  };
}
