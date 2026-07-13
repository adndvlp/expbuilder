import { cleanup } from "@testing-library/react";

import { afterEach, beforeEach, vi } from "vitest";

import mermaid from "mermaid";

import { resetDocsMermaidForTests } from "../../../pages/Docs";

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  routeError: null as unknown,
  isRouteError: false,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => routerMocks.navigate,
    useRouteError: () => routerMocks.routeError,
    isRouteErrorResponse: () => routerMocks.isRouteError,
    Link: ({ to, children, ...props }: any) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});

vi.mock("react-syntax-highlighter", () => ({
  Prism: ({ children, language }: any) => (
    <pre data-testid={`syntax-${language}`}>{children}</pre>
  ),
}));

vi.mock("react-markdown", () => ({
  default: ({ children, components }: any) => (
    <div data-testid="markdown-doc">
      <div>{children}</div>
      {components.code({
        className: "language-mermaid",
        children: "flowchart TD\nA-->B\n",
      })}
      {components.code({
        className: "language-js",
        children: "const value = 1;\n",
      })}
      {components.code({ children: "line one\nline two\n" })}
      {components.code({ children: "inline token" })}
      {components.table({
        children: (
          <tbody>
            <tr>
              <td>table cell</td>
            </tr>
          </tbody>
        ),
      })}
    </div>
  ),
}));

function registerDocsPageHooks() {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDocsMermaidForTests();
    vi.mocked(mermaid.render).mockResolvedValue({ svg: "<svg></svg>" });
  });

  afterEach(() => {
    cleanup();
    resetDocsMermaidForTests();
  });
}

function registerLandingpageHooks() {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
    delete (window as any).electron;
  });
}

function registerErrordetailHooks() {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    routerMocks.routeError = null;
    routerMocks.isRouteError = false;
  });
}

export {
  registerDocsPageHooks,
  registerErrordetailHooks,
  registerLandingpageHooks,
  routerMocks,
};
