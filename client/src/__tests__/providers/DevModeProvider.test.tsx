import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act, waitFor } from "@testing-library/react";
import React from "react";
import DevModeProvider from "../../pages/ExperimentBuilder/providers/DevModeProvider";
import DevModeContext from "../../pages/ExperimentBuilder/contexts/DevModeContext";

function renderDevModeProvider() {
  let contextValue: any = null;
  const TestConsumer = () => {
    const ctx = React.useContext(DevModeContext);
    React.useEffect(() => {
      contextValue = ctx;
    }, [ctx]);
    return null;
  };

  render(
    React.createElement(DevModeProvider, null,
      React.createElement(TestConsumer)
    )
  );

  return {
    getContext: () => contextValue,
  };
}

describe("DevModeProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        config: {
          generatedCode: "// test code",
          customCode: "",
          customInitJsPsychParams: { local: {}, public: {} },
          customPreInitCode: { local: "", public: "" },
        },
        isDevMode: false,
        isSaveMode: false,
      }),
    } as Response);
  });

  it("initializes with default state", async () => {
    const { getContext } = renderDevModeProvider();

    await waitFor(() => {
      const ctx = getContext();
      expect(ctx).toBeDefined();
    });
  });

  it("keeps defaults when the load response has no config", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response);
    const { getContext } = renderDevModeProvider();

    await waitFor(() => {
      expect(getContext()).toMatchObject({
        code: "",
        customCode: "",
        isDevMode: false,
        isSaveMode: false,
      });
    });
  });

  it("defaults missing custom code and save mode from a loaded config", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          config: {
            generatedCode: "// loaded",
            customInitJsPsychParams: { local: {}, public: {} },
            customPreInitCode: { local: "", public: "" },
          },
          isDevMode: true,
        }),
    } as Response);
    const { getContext } = renderDevModeProvider();

    await waitFor(() => {
      expect(getContext()).toMatchObject({
        code: "// loaded",
        customCode: "",
        isDevMode: true,
        isSaveMode: false,
      });
    });
  });

  it("provides dev mode toggle", async () => {
    const { getContext } = renderDevModeProvider();

    await waitFor(() => {
      const ctx = getContext();
      expect(typeof ctx.isDevMode).toBe("boolean");
      expect(typeof ctx.setDevMode).toBe("function");
      expect(typeof ctx.isSaveMode).toBe("boolean");
      expect(typeof ctx.setSaveMode).toBe("function");
    });
  });

  it("provides code state", async () => {
    const { getContext } = renderDevModeProvider();

    await waitFor(() => {
      const ctx = getContext();
      expect(typeof ctx.code).toBe("string");
      expect(typeof ctx.setCode).toBe("function");
      expect(typeof ctx.customCode).toBe("string");
      expect(typeof ctx.setCustomCode).toBe("function");
    });
  });

  it("provides custom init params", async () => {
    const { getContext } = renderDevModeProvider();

    await waitFor(() => {
      const ctx = getContext();
      expect(ctx.customInitJsPsychParams).toBeDefined();
      expect(typeof ctx.setCustomInitJsPsychParam).toBe("function");
      expect(typeof ctx.setCustomPreInitCode).toBe("function");
    });
  });

  it("setCustomInitJsPsychParam updates state", async () => {
    const { getContext } = renderDevModeProvider();

    await waitFor(() => {
      const ctx = getContext();
      expect(ctx).toBeDefined();
    });

    const ctx = getContext();
    if (ctx) {
      act(() => {
        ctx.setCustomInitJsPsychParam("local", "testParam", "testValue");
      });

      await waitFor(() => {
        const updated = getContext();
        expect(updated.customInitJsPsychParams.local.testParam).toBe("testValue");
      });
    }
  });

  it("setCustomPreInitCode updates state", async () => {
    const { getContext } = renderDevModeProvider();

    await waitFor(() => {
      const ctx = getContext();
      expect(ctx).toBeDefined();
    });

    const ctx = getContext();
    if (ctx) {
      act(() => {
        ctx.setCustomPreInitCode("local", "console.log('init')");
      });

      await waitFor(() => {
        const updated = getContext();
        expect(updated.customPreInitCode.local).toBe("console.log('init')");
      });
    }
  });

  it("setDevMode toggles dev mode", async () => {
    const { getContext } = renderDevModeProvider();

    await waitFor(() => {
      const ctx = getContext();
      expect(ctx).toBeDefined();
    });

    const ctx = getContext();
    if (ctx) {
      act(() => {
        ctx.setDevMode(true);
      });

      await waitFor(() => {
        const updated = getContext();
        expect(updated.isDevMode).toBe(true);
      });
    }
  });
});
