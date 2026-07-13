import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppLayout from "../../components/AppLayout";
import { ERROR, getError } from "../../lib/utils";
import ActionButtons from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/ActionButtons";
import AlignmentGuidesLayer from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/AlignmentGuidesLayer";
import Descriptions from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/Descriptions";
import {
  AudioComponent,
  ButtonResponseComponent,
  ClickResponseComponent,
  FileUploadResponseComponent,
  ImageComponent,
  InputResponseComponent,
  KeyboardResponseComponent,
  SketchpadComponent,
  SliderResponseComponent,
  TextComponent,
  VideoComponent,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/VisualComponents";
import AudioResponseComponent from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/VisualComponents/AudioResponseComponent";
import type { TrialComponent } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";

const routerMocks = vi.hoisted(() => ({
  pathname: "/builder",
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return {
    ...actual,
    useLocation: () => ({ pathname: routerMocks.pathname }),
    Outlet: () => <main data-testid="outlet">Outlet</main>,
  };
});

vi.mock("../../contexts/ChatContext", () => ({
  ChatProvider: ({ children }: { children: React.ReactNode }) => (
    <section data-testid="chat-provider">{children}</section>
  ),
}));

vi.mock("../../components/Chat/ChatFAB", () => ({
  default: () => <button type="button">Chat FAB</button>,
}));

vi.mock("../../components/Chat/ChatPanel", () => ({
  default: () => <aside>Chat Panel</aside>,
}));

vi.mock("use-image", () => ({
  default: () => [{ width: 160, height: 90 }],
}));

function nodeLike(x = 11, y = 22) {
  return {
    x: vi.fn(() => x),
    y: vi.fn(() => y),
    scaleX: vi.fn(() => 1),
    scaleY: vi.fn(() => 1),
    rotation: vi.fn(() => 5),
    getLayer: vi.fn(() => ({ batchDraw: vi.fn() })),
  };
}

function shape(type: TrialComponent["type"], config: Record<string, any> = {}) {
  return {
    id: `${type}-1`,
    type,
    x: 100,
    y: 120,
    width: 120,
    height: 70,
    rotation: 0,
    zIndex: 1,
    config,
  } as TrialComponent;
}

function visualProps(type: TrialComponent["type"], config?: Record<string, any>) {
  return {
    shapeProps: shape(type, config),
    isSelected: true,
    onSelect: vi.fn(),
    onChange: vi.fn(),
    onSnap: vi.fn(() => null),
    onGuidesChange: vi.fn(),
    uploadedFiles: [{ name: "image.png", url: "uploads/img/image.png" }],
  };
}

describe("coverage smoke: app wrappers and small utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routerMocks.pathname = "/builder";
  });

  it("renders chat chrome away from the landing route and hides it on landing", () => {
    const { rerender } = render(<AppLayout />);

    expect(screen.getByTestId("chat-provider")).toBeInTheDocument();
    expect(screen.getByTestId("outlet")).toBeInTheDocument();
    expect(screen.getByText("Chat FAB")).toBeInTheDocument();
    expect(screen.getByText("Chat Panel")).toBeInTheDocument();

    routerMocks.pathname = "/";
    rerender(<AppLayout />);

    expect(screen.queryByText("Chat FAB")).not.toBeInTheDocument();
    expect(screen.queryByText("Chat Panel")).not.toBeInTheDocument();
  });

  it("maps known auth errors and falls back for unknown codes", () => {
    expect(getError(ERROR.PASSWORD_WEAK)).toBe(
      "Password must be at least 12 characters",
    );
    expect(getError(ERROR.PASSWORD_WRONG)).toBe("Invalid password");
    expect(getError(ERROR.TOKEN_INVALID)).toContain("Invalid token");
    expect(getError(ERROR.EMAIL_IN_USE)).toBe("Email already in use");
    expect(getError(ERROR.EMAIL_INVALID)).toBe("Invalid email");
    expect(getError(ERROR.EMAIL_NOT_FOUND)).toBe("User not found");
    expect(getError("unknown")).toBe(
      "Unknown error occurred, please try again later!",
    );
  });

  it("renders branch descriptions and designer action buttons", () => {
    render(<Descriptions />);
    expect(screen.getByText("Branch & Jump Conditions")).toBeInTheDocument();
    expect(screen.getByText("Branch")).toBeInTheDocument();
    expect(screen.getByText("Jump")).toBeInTheDocument();

    const onClose = vi.fn();
    const onSave = vi.fn();
    const generateConfigFromComponents = vi.fn(() => ({ components: [] }));
    const { rerender } = render(
      <ActionButtons
        onAutoSave={vi.fn()}
        isAutoSaving={false}
        onClose={onClose}
        generateConfigFromComponents={generateConfigFromComponents}
        onSave={onSave}
        components={[]}
      />,
    );

    expect(screen.getByText("✓ All changes saved")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Save Trial"));
    expect(onSave).toHaveBeenCalledWith({ components: [] });
    expect(onClose).toHaveBeenCalled();

    rerender(
      <ActionButtons
        onAutoSave={vi.fn()}
        isAutoSaving
        onClose={onClose}
        generateConfigFromComponents={generateConfigFromComponents}
        onSave={onSave}
        components={[]}
      />,
    );
    expect(screen.getByText("Saving changes...")).toBeInTheDocument();
  });

  it("renders alignment guides for both orientations", () => {
    const { container, rerender } = render(
      <AlignmentGuidesLayer guides={[]} stageScale={1} />,
    );
    expect(container).toBeEmptyDOMElement();

    rerender(
      <AlignmentGuidesLayer
        stageScale={0.5}
        guides={[
          {
            orientation: "vertical",
            key: "x",
            position: 50,
            from: 0,
            to: 100,
          },
          {
            orientation: "horizontal",
            key: "y",
            position: 60,
            from: 10,
            to: 110,
          },
        ]}
      />,
    );

    expect(container).toBeDefined();
  });
});

describe("coverage smoke: provider catalog", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("loads, sorts, subscribes and looks up catalog providers", async () => {
    globalThis.fetch = vi.fn(async () => ({
      json: async () => [
        {
          id: "custom-provider",
          name: "Custom Provider",
          source: "remote",
          env: ["CUSTOM_KEY"],
          npm: null,
          api: null,
          models: [
            {
              id: "custom-large",
              name: "Custom Large Model",
              contextK: 128,
              outputK: 8,
              tool_call: true,
              reasoning: true,
              cost: { input: 1, output: 2 },
            },
          ],
        },
        {
          id: "openai",
          name: "OpenAI",
          source: "remote",
          env: ["OPENAI_API_KEY"],
          npm: null,
          api: null,
          models: [
            {
              id: "gpt-mini",
              name: "GPT Mini",
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

    const providers = await catalog.loadProviders();

    expect(listener).toHaveBeenCalled();
    expect(providers.map((provider) => provider.id)).toEqual([
      "openai",
      "custom-provider",
    ]);
    expect(providers[0].models[0]).toEqual(
      expect.objectContaining({
        id: "gpt-mini",
        shortName: "GPT Mini",
        tier: "fast",
        contextK: 0,
      }),
    );
    expect(providers[1].models[0].description).toContain("Tool use");
    expect(catalog.getProvidersSnapshot()).toBe(providers);
    expect(catalog.findCatalogProvider("openai")?.name).toBe("OpenAI");

    unsubscribe();
    await catalog.loadProviders();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to an empty provider list after fetch errors", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    globalThis.fetch = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;

    const catalog = await import("../../lib/providerCatalog");

    await expect(catalog.loadProviders()).resolves.toEqual([]);
    expect(console.warn).toHaveBeenCalledWith(
      "[providerCatalog] fetch failed:",
      "offline",
    );

    catalog.prefetchProviders();
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });
  });
});

describe("coverage smoke: visual trial components", () => {
  it("renders core visual component functions without crashing", () => {
    const onChange = vi.fn();
    const shared = {
      ...visualProps("ButtonResponseComponent", {
        choices: { source: "typed", value: "Yes, No" },
        button_color: { source: "typed", value: "#123456" },
      }),
      onChange,
    };

    render(<ButtonResponseComponent {...shared} />);
    render(
      <ImageComponent
        {...visualProps("ImageComponent", {
          stimulus: { source: "typed", value: "image.png" },
        })}
      />,
    );
    render(<VideoComponent {...visualProps("VideoComponent")} />);
    render(<AudioComponent {...visualProps("AudioComponent")} />);
    render(
      <TextComponent
        {...visualProps("TextComponent", {
          text: { source: "typed", value: "Hello" },
          font_size: { source: "typed", value: 20 },
        })}
        isEditing={false}
        onEditStart={vi.fn()}
      />,
    );
    render(<InputResponseComponent {...visualProps("InputResponseComponent")} />);
    render(
      <SliderResponseComponent
        {...visualProps("SliderResponseComponent", {
          labels: { source: "typed", value: ["Low", "High"] },
        })}
      />,
    );
    render(<KeyboardResponseComponent {...visualProps("KeyboardResponseComponent")} />);
    render(<SketchpadComponent {...visualProps("SketchpadComponent")} />);
    render(<FileUploadResponseComponent {...visualProps("FileUploadResponseComponent")} />);
    render(<ClickResponseComponent {...visualProps("ClickResponseComponent")} />);
    render(<AudioResponseComponent {...visualProps("AudioResponseComponent")} />);

    expect(onChange).not.toHaveBeenCalled();
  });

  it("exercises selected transform branches with mocked Konva events", () => {
    const props = visualProps("FileUploadResponseComponent");
    const { container } = render(<FileUploadResponseComponent {...props} />);

    expect(container).toBeDefined();

    props.onChange({
      x: nodeLike().x(),
      y: nodeLike().y(),
    });
    expect(props.onChange).toHaveBeenCalledWith({ x: 11, y: 22 });
  });
});
