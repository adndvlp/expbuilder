import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import React, { useContext } from "react";
import { UserContext } from "../../../lib/context";
import { theme } from "../../../lib/theme";
import "./testHarness";

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
    vi.doMock("../../../components/AppLayout", () => ({
      default: page("layout"),
    }));
    vi.doMock("../../../pages/Dashboard", () => ({
      default: page("dashboard"),
    }));
    vi.doMock("../../../pages/ExperimentBuilder", () => ({
      default: page("builder"),
    }));
    vi.doMock(
      "../../../pages/ExperimentBuilder/providers/PluginsProvider",
      () => ({
        default: ({ children }: { children: React.ReactNode }) => (
          <section>{children}</section>
        ),
      }),
    );
    vi.doMock(
      "../../../pages/ExperimentBuilder/providers/DevModeProvider",
      () => ({
        default: ({ children }: { children: React.ReactNode }) => (
          <section>{children}</section>
        ),
      }),
    );
    vi.doMock("../../../pages/LandingPage", () => ({
      default: page("landing"),
    }));
    vi.doMock("../../../pages/Auth/Register", () => ({
      default: page("register"),
    }));
    vi.doMock("../../../pages/Auth/Login", () => ({ default: page("login") }));
    vi.doMock("../../../pages/ErrorDetail", () => ({ default: page("error") }));
    vi.doMock("../../../pages/Settings", () => ({ default: page("settings") }));
    vi.doMock(
      "../../../pages/Settings/GoogleDrive/GoogleDriveCallback",
      () => ({
        default: page("google-drive"),
      }),
    );
    vi.doMock("../../../pages/Settings/Dropbox/DropboxCallback", () => ({
      default: page("dropbox"),
    }));
    vi.doMock("../../../pages/Settings/Github/GithubCallback", () => ({
      default: page("github"),
    }));
    vi.doMock("../../../pages/Settings/OsfCallback", () => ({
      default: page("osf"),
    }));
    vi.doMock("../../../pages/ExperimentPanel", () => ({
      default: page("experiment-panel"),
    }));
    vi.doMock("../../../pages/Docs", () => ({ default: page("docs") }));

    const { default: router } = await import("../../../pages");

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
    vi.doMock("../../../pages", () => ({ default: fakeRouter }));

    await import("../../../main");

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
