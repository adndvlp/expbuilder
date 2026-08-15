import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SessionsActions from "../../../pages/ExperimentBuilder/components/ResultsList/SessionsActions";
import type {
  SessionMeta,
  TabType,
} from "../../../pages/ExperimentBuilder/components/ResultsList";

const firestoreMocks = vi.hoisted(() => ({
  collection: vi.fn((...segments: string[]) => segments.join("/")),
  getDocs: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: firestoreMocks.collection,
  getDocs: firestoreMocks.getDocs,
}));

function okJson(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: vi.fn(async () => payload),
  } as unknown as Response;
}

function session(experimentID: string): SessionMeta {
  return {
    _id: `${experimentID}-session`,
    sessionId: `${experimentID}-session`,
    createdAt: "2026-08-13T12:00:00.000Z",
    state: "completed",
  };
}

describe("SessionsActions experiment isolation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("ignores a stale response after switching experiments", async () => {
    let resolveFirst: (response: Response) => void = () => undefined;
    const firstResponse = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });
    const firstSession = session("experiment-a");
    const secondSession = session("experiment-b");
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.endsWith("/experiment-a")) return firstResponse;
      if (url.endsWith("/experiment-b")) {
        return okJson({ sessions: [secondSession] });
      }
      throw new Error(`Unexpected URL: ${url}`);
    }) as unknown as typeof fetch;

    const setters = {
      setSelected: vi.fn(),
      setLoading: vi.fn(),
      setOnlineLoading: vi.fn(),
      setSessions: vi.fn(),
      setSelectMode: vi.fn(),
    };
    const createProps = (experimentID: string | undefined) => ({
      experimentID,
      localActiveSessions: [],
      activeTab: "local" as TabType,
      selected: [],
      sessions: [],
      ...setters,
    });
    const { rerender } = renderHook(
      ({ experimentID }) => SessionsActions(createProps(experimentID)),
      { initialProps: { experimentID: "experiment-a" } },
    );

    rerender({ experimentID: "experiment-b" });
    await waitFor(() => {
      expect(setters.setSessions).toHaveBeenLastCalledWith([secondSession]);
    });

    await act(async () => {
      resolveFirst(okJson({ sessions: [firstSession] }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(setters.setSessions).toHaveBeenLastCalledWith([secondSession]);
  });

  it("clears loading when the current experiment is removed", async () => {
    let resolveFirst: (response: Response) => void = () => undefined;
    const firstResponse = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });
    globalThis.fetch = vi.fn(async () => firstResponse) as unknown as typeof fetch;
    const setters = {
      setSelected: vi.fn(),
      setLoading: vi.fn(),
      setOnlineLoading: vi.fn(),
      setSessions: vi.fn(),
      setSelectMode: vi.fn(),
    };
    const createProps = (experimentID: string | undefined) => ({
      experimentID,
      localActiveSessions: [],
      activeTab: "local" as TabType,
      selected: [],
      sessions: [],
      ...setters,
    });
    const { rerender } = renderHook(
      ({ experimentID }: { experimentID: string | undefined }) =>
        SessionsActions(createProps(experimentID)),
      { initialProps: { experimentID: "experiment-a" } },
    );

    rerender({ experimentID: undefined });
    expect(setters.setLoading).toHaveBeenLastCalledWith(false);

    await act(async () => {
      resolveFirst(okJson({ sessions: [session("experiment-a")] }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(setters.setSessions).toHaveBeenLastCalledWith([]);
  });
});
