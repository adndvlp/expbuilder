import { act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { notOkJson } from "../../helpers/trialFactories";
import {
  queueFetchResponses,
  registerTrialsProviderLifecycle,
  renderLoadedProvider,
} from "./testHarness";

describe("TrialsProvider strict loop timeline loading", () => {
  registerTrialsProviderLifecycle();

  it("propagates failures when the Canvas requests strict loading", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const view = await renderLoadedProvider();
    queueFetchResponses(notOkJson());
    let failure: unknown;

    await act(async () => {
      try {
        await view
          .getContext()
          ?.getLoopTimeline("missing-loop", true, true, true);
      } catch (cause: unknown) {
        failure = cause;
      }
    });

    expect(failure).toBeInstanceOf(Error);
    expect(console.error).toHaveBeenCalledWith(
      "Error loading loop trials timeline:",
      failure,
    );
  });
});
