import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import useUrl from "../../../pages/ExperimentBuilder/hooks/useUrl";
import UrlProvider from "../../../pages/ExperimentBuilder/providers/UrlProvider";
import {
  API_URL,
  cleanupProviderTest,
  prepareProviderTest,
} from "./testHarness";

function UrlWrapper({ children }: { children: ReactNode }) {
  return <UrlProvider>{children}</UrlProvider>;
}

describe("UrlProvider", () => {
  beforeEach(prepareProviderTest);
  afterEach(cleanupProviderTest);

  it("derives experiment and preview URLs from the active experiment id", async () => {
    const { result } = renderHook(() => useUrl(), { wrapper: UrlWrapper });

    await waitFor(() => {
      expect(result.current.experimentUrl).toBe(`${API_URL}/test-exp-123`);
      expect(result.current.trialUrl).toBe(`${API_URL}/test-exp-123/preview`);
    });

    act(() => {
      result.current.setExperimentUrl("https://custom.test/experiment");
      result.current.setTrialUrl("https://custom.test/preview");
    });

    expect(result.current.experimentUrl).toBe("https://custom.test/experiment");
    expect(result.current.trialUrl).toBe("https://custom.test/preview");
  });
});
