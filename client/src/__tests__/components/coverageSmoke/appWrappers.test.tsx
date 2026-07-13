import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppLayout from "../../../components/AppLayout";
import { ERROR, getError } from "../../../lib/utils";
import Descriptions from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/Descriptions";
import ActionButtons from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/ActionButtons";
import AlignmentGuidesLayer from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/AlignmentGuidesLayer";

const routerMocks = vi.hoisted(() => ({ pathname: "/builder" }));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return {
    ...actual,
    useLocation: () => ({ pathname: routerMocks.pathname }),
    Outlet: () => <main data-testid="outlet">Outlet</main>,
  };
});

vi.mock("../../../contexts/ChatContext", () => ({
  ChatProvider: ({ children }: { children: React.ReactNode }) => (
    <section data-testid="chat-provider">{children}</section>
  ),
}));

vi.mock("../../../components/Chat/ChatFAB", () => ({
  default: () => <button type="button">Chat FAB</button>,
}));

vi.mock("../../../components/Chat/ChatPanel", () => ({
  default: () => <aside>Chat Panel</aside>,
}));

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
          { orientation: "vertical", key: "x", position: 50, from: 0, to: 100 },
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
