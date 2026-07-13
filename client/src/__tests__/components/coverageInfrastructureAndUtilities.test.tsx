import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import React, { useContext } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserContext } from "../../lib/context";
import { theme } from "../../lib/theme";
import { useExperimentState } from "../../pages/ExperimentBuilder/hooks/useExpetimentState";
import {
  buildPastedComponents,
  cloneTrialComponents,
  getSelectedTrialComponents,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/designerComponentClipboard";
import { snapKonvaNode } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/snapKonvaNode";
import type { TrialComponent } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.doUnmock("../../lib/firebase");
  vi.unstubAllEnvs();
  delete (window as any).electron;
  document.body.innerHTML = "";
});

function sampleComponent(overrides: Partial<TrialComponent> = {}): TrialComponent {
  return {
    id: "text-1",
    type: "TextComponent",
    x: 10,
    y: 20,
    width: 100,
    height: 40,
    rotation: 0,
    zIndex: 2,
    config: {
      name: { source: "typed", value: "Title" },
    },
    ...overrides,
  } as TrialComponent;
}

describe("coverage infrastructure: static exports and router bootstrap", () => {
  it("exposes context defaults and the application theme", () => {
    function UserProbe() {
      const value = useContext(UserContext);
      return <span>{value.user ? "signed-in" : "anonymous"}</span>;
    }

    render(<UserProbe />);

    expect(screen.getByText("anonymous")).toBeInTheDocument();
    expect(theme.colors.greyBackground).toBe("#1C1F22");
    expect(theme.components.Link.baseStyle.color).toBe("brandOrange.500");
  });

  it("creates the hash router with expected routes without mounting heavy pages", async () => {
    const createHashRouter = vi.fn((routes) => ({ routes }));
    const page = (name: string) => () => <div>{name}</div>;

    vi.doMock("react-router-dom", () => ({
      createHashRouter,
    }));
    vi.doMock("../../components/AppLayout", () => ({ default: page("layout") }));
    vi.doMock("../../pages/Dashboard", () => ({ default: page("dashboard") }));
    vi.doMock("../../pages/ExperimentBuilder", () => ({ default: page("builder") }));
    vi.doMock("../../pages/ExperimentBuilder/providers/PluginsProvider", () => ({
      default: ({ children }: { children: React.ReactNode }) => (
        <section>{children}</section>
      ),
    }));
    vi.doMock("../../pages/ExperimentBuilder/providers/DevModeProvider", () => ({
      default: ({ children }: { children: React.ReactNode }) => (
        <section>{children}</section>
      ),
    }));
    vi.doMock("../../pages/LandingPage", () => ({ default: page("landing") }));
    vi.doMock("../../pages/Auth/Register", () => ({ default: page("register") }));
    vi.doMock("../../pages/Auth/Login", () => ({ default: page("login") }));
    vi.doMock("../../pages/ErrorDetail", () => ({ default: page("error") }));
    vi.doMock("../../pages/Settings", () => ({ default: page("settings") }));
    vi.doMock("../../pages/Settings/GoogleDrive/GoogleDriveCallback", () => ({
      default: page("google-drive"),
    }));
    vi.doMock("../../pages/Settings/Dropbox/DropboxCallback", () => ({
      default: page("dropbox"),
    }));
    vi.doMock("../../pages/Settings/Github/GithubCallback", () => ({
      default: page("github"),
    }));
    vi.doMock("../../pages/Settings/OsfCallback", () => ({
      default: page("osf"),
    }));
    vi.doMock("../../pages/ExperimentPanel", () => ({
      default: page("experiment-panel"),
    }));
    vi.doMock("../../pages/Docs", () => ({ default: page("docs") }));

    const { default: router } = await import("../../pages");

    expect(router.routes[0].children.map((route: any) => route.path)).toEqual([
      "/",
      "/auth/register",
      "/auth/login",
      "/home",
      "/settings",
      "/google-drive-callback",
      "/dropbox-callback",
      "/github-callback",
      "/oauth/osf/callback",
      "/docs",
      "/home/experiment/:id",
      "/home/experiment/:id/builder",
    ]);
    expect(createHashRouter).toHaveBeenCalledTimes(1);
  });

  it("mounts the main React root with the configured router", async () => {
    const renderRoot = vi.fn();
    const createRoot = vi.fn(() => ({ render: renderRoot }));
    const fakeRouter = { id: "router" };
    const routerProvider = vi.fn(({ router }: { router: unknown }) => (
      <div data-testid="router-provider">{String((router as any).id)}</div>
    ));

    document.body.innerHTML = '<div id="root"></div>';
    vi.doMock("react-dom/client", () => ({ createRoot }));
    vi.doMock("react-router-dom", () => ({ RouterProvider: routerProvider }));
    vi.doMock("../../pages", () => ({ default: fakeRouter }));

    await import("../../main");

    expect(createRoot).toHaveBeenCalledWith(document.getElementById("root"));
    expect(renderRoot).toHaveBeenCalledTimes(1);
    const renderedTree = renderRoot.mock.calls[0][0];
    render(renderedTree);
    expect(screen.getByTestId("router-provider")).toHaveTextContent("router");
    expect(routerProvider).toHaveBeenCalledWith(
      expect.objectContaining({ router: fakeRouter }),
      undefined,
    );
  });
});

describe("coverage infrastructure: firebase module", () => {
  it("initializes the web production build without Electron or emulators", async () => {
    const app = { name: "web-app" };
    const auth = { currentUser: null };
    const db = { app };
    const initializeApp = vi.fn(() => app);
    const connectAuthEmulator = vi.fn();
    const connectFirestoreEmulator = vi.fn();
    vi.stubEnv("DEV", "");
    delete (window as any).electron;
    vi.doUnmock("../../lib/firebase");
    vi.doMock("firebase/app", () => ({ initializeApp }));
    vi.doMock("firebase/auth", () => ({
      getAuth: vi.fn(() => auth),
      connectAuthEmulator,
    }));
    vi.doMock("firebase/firestore", () => ({
      getFirestore: vi.fn(() => db),
      connectFirestoreEmulator,
    }));

    const firebase = await import("../../lib/firebase");

    await expect(firebase.getFirebaseApp()).resolves.toBe(app);
    expect(initializeApp).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "test-key" }),
    );
    expect(connectAuthEmulator).not.toHaveBeenCalled();
    expect(connectFirestoreEmulator).not.toHaveBeenCalled();
  });

  it("initializes Firebase from custom Electron credentials and exposes async getters", async () => {
    const app = { name: "custom-app" };
    const auth = { currentUser: null };
    const db = { app };
    const initializeApp = vi.fn(() => app);
    const getAuth = vi.fn(() => auth);
    const getFirestore = vi.fn(() => db);
    const connectAuthEmulator = vi.fn();
    const connectFirestoreEmulator = vi.fn();
    const customConfig = {
      apiKey: "custom-key",
      authDomain: "custom.firebaseapp.com",
      projectId: "custom",
      storageBucket: "custom.appspot.com",
      messagingSenderId: "123",
      appId: "app",
    };

    vi.doUnmock("../../lib/firebase");
    vi.doMock("firebase/app", () => ({ initializeApp }));
    vi.doMock("firebase/auth", () => ({ getAuth, connectAuthEmulator }));
    vi.doMock("firebase/firestore", () => ({
      getFirestore,
      connectFirestoreEmulator,
    }));
    vi.spyOn(console, "log").mockImplementation(() => {});
    (window as any).electron = {
      readFirebaseConfig: vi.fn(async () => customConfig),
    };

    const firebase = await import("../../lib/firebase");

    await expect(firebase.getFirebaseApp()).resolves.toBe(app);
    await expect(firebase.getFirebaseAuth()).resolves.toBe(auth);
    await expect(firebase.getFirebaseDb()).resolves.toBe(db);
    expect(initializeApp).toHaveBeenCalledWith(customConfig);
    expect(getAuth).toHaveBeenCalledWith(app);
    expect(getFirestore).toHaveBeenCalledWith(app);
    await waitFor(() => {
      expect(connectAuthEmulator).toHaveBeenCalledWith(
        auth,
        "http://localhost:9099",
      );
      expect(connectFirestoreEmulator).toHaveBeenCalledWith(db, "localhost", 8080);
    });
  });

  it("falls back to default Firebase config when Electron returns no api key", async () => {
    const app = { name: "default-app" };
    const initializeApp = vi.fn(() => app);

    vi.doUnmock("../../lib/firebase");
    vi.doMock("firebase/app", () => ({ initializeApp }));
    vi.doMock("firebase/auth", () => ({
      getAuth: vi.fn(() => ({ currentUser: null })),
      connectAuthEmulator: vi.fn(),
    }));
    vi.doMock("firebase/firestore", () => ({
      getFirestore: vi.fn(() => ({ app })),
      connectFirestoreEmulator: vi.fn(),
    }));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    (window as any).electron = {
      readFirebaseConfig: vi.fn(async () => ({})),
    };

    const firebase = await import("../../lib/firebase");

    await expect(firebase.getFirebaseApp()).resolves.toBe(app);
    expect(log).toHaveBeenCalledWith("Using default Firebase configuration");
    expect(initializeApp).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "test-key" }),
    );
  });

  it("falls back to default Firebase config when Electron config loading fails", async () => {
    const app = { name: "fallback-app" };
    const error = new Error("read failed");
    const initializeApp = vi.fn(() => app);

    vi.doUnmock("../../lib/firebase");
    vi.doMock("firebase/app", () => ({ initializeApp }));
    vi.doMock("firebase/auth", () => ({
      getAuth: vi.fn(() => ({ currentUser: null })),
      connectAuthEmulator: vi.fn(),
    }));
    vi.doMock("firebase/firestore", () => ({
      getFirestore: vi.fn(() => ({ app })),
      connectFirestoreEmulator: vi.fn(),
    }));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    (window as any).electron = {
      readFirebaseConfig: vi.fn(async () => {
        throw error;
      }),
    };

    const firebase = await import("../../lib/firebase");

    await expect(firebase.getFirebaseApp()).resolves.toBe(app);
    expect(log).toHaveBeenCalledWith(
      "Error loading custom Firebase config, using default",
      error,
    );
    expect(initializeApp).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "test-key" }),
    );
  });
});

describe("coverage utilities: experiment state and designer helpers", () => {
  it("loads provider catalog metadata, caches snapshots and notifies subscribers", async () => {
    vi.resetModules();
    globalThis.fetch = vi.fn(async () => ({
      json: async () => [
        {
          id: "custom-provider",
          name: "Custom Provider",
          source: "test",
          env: ["CUSTOM_KEY"],
          npm: null,
          api: null,
          models: [
            {
              id: "custom-mini",
              name: "Custom Mini",
              contextK: null,
              outputK: null,
              tool_call: true,
              reasoning: true,
              cost: { input: 0.1, output: 0.2 },
            },
          ],
        },
        {
          id: "openai",
          name: "OpenAI",
          source: "test",
          env: ["OPENAI_API_KEY"],
          npm: null,
          api: null,
          models: [
            {
              id: "gpt-5-pro",
              name: "GPT 5 Pro",
              contextK: 256,
              outputK: null,
              tool_call: false,
              reasoning: false,
              cost: null,
            },
          ],
        },
        {
          id: "another-provider",
          name: "Another Provider",
          source: "test",
          env: [],
          npm: null,
          api: null,
          models: [
            {
              id: "plain-model",
              name: "Extraordinary Model Name",
              contextK: null,
              outputK: null,
              tool_call: false,
              reasoning: false,
              cost: null,
            },
          ],
        },
      ],
    })) as unknown as typeof fetch;

    const catalog = await import("../../lib/providerCatalog");
    const listener = vi.fn();
    const unsubscribe = catalog.subscribeProviders(listener);

    expect(catalog.getProvidersSnapshot()).toEqual([]);
    const providers = await catalog.loadProviders();

    expect(providers.map((provider) => provider.id)).toEqual([
      "openai",
      "another-provider",
      "custom-provider",
    ]);
    expect(providers[0].requiresKey).toBe(true);
    expect(providers[0].models[0]).toEqual(
      expect.objectContaining({
        shortName: "GPT 5",
        contextK: 256,
        tier: "powerful",
        description: "256K context",
      }),
    );
    expect(providers[1].models[0]).toEqual(
      expect.objectContaining({
        shortName: "Extraordinary…",
        contextK: 0,
        tier: "balanced",
        description: "Extraordinary Model Name",
      }),
    );
    expect(providers[2].models[0]).toEqual(
      expect.objectContaining({
        contextK: 0,
        tier: "fast",
        description: "Chain-of-thought reasoning · Tool use · $0.1/M in",
      }),
    );
    expect(listener).toHaveBeenCalledTimes(1);
    expect(catalog.getProvidersSnapshot()).toBe(providers);
    expect(catalog.findCatalogProvider("openai")?.name).toBe("OpenAI");
    await expect(catalog.loadProviders()).resolves.toBe(providers);
    catalog.prefetchProviders();

    unsubscribe();
    catalog.subscribeProviders(vi.fn())();
  });

  it("reuses the in-flight provider catalog request", async () => {
    vi.resetModules();
    let resolveFetch!: (response: { json: () => Promise<unknown[]> }) => void;
    globalThis.fetch = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    ) as unknown as typeof fetch;

    const catalog = await import("../../lib/providerCatalog");
    const firstLoad = catalog.loadProviders();
    const secondLoad = catalog.loadProviders();

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    resolveFetch({
      json: async () => [],
    });
    await expect(firstLoad).resolves.toEqual([]);
    await expect(secondLoad).resolves.toEqual([]);
  });

  it("falls back to the current provider snapshot when catalog loading fails", async () => {
    vi.resetModules();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    globalThis.fetch = vi.fn(async () => {
      throw new Error("catalog down");
    }) as unknown as typeof fetch;

    const catalog = await import("../../lib/providerCatalog");

    await expect(catalog.loadProviders()).resolves.toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      "[providerCatalog] fetch failed:",
      "catalog down",
    );
    catalog.prefetchProviders();
  });

  it("notifies hook subscribers when experiment version increments", () => {
    const { result } = renderHook(() => useExperimentState());
    const startingVersion = result.current.version;

    act(() => {
      result.current.incrementVersion();
    });

    expect(result.current.version).toBe(startingVersion + 1);
  });

  it("clones, selects and builds pasted trial components with new names and positions", () => {
    vi.spyOn(Date, "now").mockReturnValue(12345);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const source = sampleComponent();
    const cloned = cloneTrialComponents([source]);

    cloned[0].config.name.value = "Changed";
    expect(source.config.name.value).toBe("Title");
    expect(getSelectedTrialComponents([source], ["text-1"])).toEqual([source]);
    expect(getSelectedTrialComponents([source], ["missing"])).toEqual([]);

    const pasted = buildPastedComponents({
      clipboardComponents: [source, sampleComponent({ id: "text-2", x: 280 })],
      existingComponents: [sampleComponent({ id: "existing", zIndex: 7 })],
      canvasWidth: 300,
      canvasHeight: 200,
      pasteAt: { x: 50, y: 60 },
      toJsPsychCoords: (x, y) => ({ x: x / 2, y: y / 2 }),
    });

    expect(pasted).toHaveLength(2);
    expect(pasted[0]).toMatchObject({
      x: 50,
      y: 60,
      zIndex: 8,
    });
    expect(pasted[0].id).toBe("TextComponent-12345-0-i");
    expect(pasted[0].config.name.value).toBe("Title_copy");
    expect(pasted[0].config.coordinates.value).toEqual({ x: 25, y: 30 });
    expect(pasted[1].x).toBe(300);
    expect(pasted[1].config.name.value).toBe("Title_copy_2");

    expect(
      buildPastedComponents({
        clipboardComponents: [],
        existingComponents: [],
        canvasWidth: 100,
        canvasHeight: 100,
        pasteCount: 2,
        toJsPsychCoords: (x, y) => ({ x, y }),
      }),
    ).toEqual([]);
  });

  it("snaps Konva nodes and clears guides when no snap target exists", () => {
    const batchDraw = vi.fn();
    const node = {
      x: vi.fn((value?: number) => (value === undefined ? 10 : undefined)),
      y: vi.fn((value?: number) => (value === undefined ? 20 : undefined)),
      rotation: vi.fn(() => 3),
      getLayer: vi.fn(() => ({ batchDraw })),
    };
    const onGuidesChange = vi.fn();
    const onSnap = vi.fn(() => ({
      x: 12,
      y: 24,
      guides: [{ orientation: "vertical", position: 12, from: 0, to: 40 }],
    }));

    expect(
      snapKonvaNode({
        node: node as any,
        id: "shape-1",
        width: 100,
        height: 50,
        onSnap,
        onGuidesChange,
      }),
    ).toEqual({
      x: 12,
      y: 24,
      guides: [{ orientation: "vertical", position: 12, from: 0, to: 40 }],
    });
    expect(onSnap).toHaveBeenCalledWith({
      id: "shape-1",
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      rotation: 3,
    });
    expect(node.x).toHaveBeenCalledWith(12);
    expect(node.y).toHaveBeenCalledWith(24);
    expect(batchDraw).toHaveBeenCalled();
    expect(onGuidesChange).toHaveBeenCalledWith([
      { orientation: "vertical", position: 12, from: 0, to: 40 },
    ]);

    onSnap.mockReturnValue(null);
    expect(
      snapKonvaNode({
        node: node as any,
        id: "shape-1",
        width: 100,
        height: 50,
        onSnap,
        onGuidesChange,
      }),
    ).toEqual({ x: 10, y: 20, guides: [] });
    expect(onGuidesChange).toHaveBeenLastCalledWith([]);
  });
});
