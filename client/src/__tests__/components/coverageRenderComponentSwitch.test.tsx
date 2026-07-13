import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  component,
  Harness,
} from "./coverageRenderComponentSwitch/renderComponentHarness";

describe("renderComponent switch coverage", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it.each([
    "ImageComponent",
    "ButtonResponseComponent",
    "VideoComponent",
    "AudioComponent",
    "KeyboardResponseComponent",
    "SliderResponseComponent",
    "InputResponseComponent",
    "SketchpadComponent",
    "AudioResponseComponent",
    "FileUploadResponseComponent",
    "ClickResponseComponent",
  ] as const)(
    "renders and updates %s through its visual component",
    async (type) => {
      render(
        <Harness
          initial={component(type, { id: `${type}-case` })}
          selectedIds={[`${type}-case`]}
          withCanvasStyles={type === "ImageComponent"}
        />,
      );

      fireEvent.click(screen.getByTestId(`visual-${type}-${type}-case`));

      await waitFor(() => {
        expect(screen.getByTestId("selected")).toHaveTextContent(
          `${type}-case`,
        );
        expect(screen.getByTestId("state")).toHaveTextContent('"coordinates"');
        expect(screen.getByTestId("state")).toHaveTextContent('"rotation"');
        expect(screen.getByTestId("saved")).toHaveTextContent(`${type}-case`);
      });
    },
  );

  it("routes selected text components through the editable text visual component", async () => {
    render(
      <Harness
        initial={component("TextComponent", { id: "text-selected" })}
        selectedId="text-selected"
      />,
    );

    fireEvent.click(screen.getByTestId("visual-TextComponent-text-selected"));

    await waitFor(() => {
      expect(screen.getByTestId("editing")).toHaveTextContent("text-selected");
      expect(screen.getByTestId("state")).toHaveTextContent('"font_size"');
    });
  });

  it("routes html scene components through EditorHitBox callbacks without autosave for transient changes", async () => {
    render(
      <Harness
        initial={component("HtmlComponent", { id: "html-scene" })}
        withAutoSave={false}
      />,
    );

    fireEvent.click(screen.getByTestId("hitbox-html-scene"));

    await waitFor(() => {
      expect(screen.getByTestId("selected")).toHaveTextContent("html-scene");
      expect(screen.getByTestId("active")).toHaveTextContent("html-scene");
      expect(screen.getByTestId("editing")).toHaveTextContent("html-scene");
      expect(screen.getByTestId("state")).not.toHaveTextContent(
        '"coordinates"',
      );
      expect(screen.getByTestId("history")).toHaveTextContent("0");
      expect(screen.getByTestId("saved")).toHaveTextContent("none");
    });
  });

  it("updates default rectangles on select and drag", async () => {
    render(
      <Harness
        initial={component("UnknownComponent", {
          id: "unknown-rect",
          width: 40,
          height: 20,
        })}
        selectedId="unknown-rect"
      />,
    );

    expect(screen.getByTestId("rect-unknown-rect")).toHaveAttribute(
      "data-stroke",
      "#374151",
    );
    fireEvent.click(screen.getByText("select rect"));
    fireEvent.click(screen.getByText("drag rect"));

    await waitFor(() => {
      expect(screen.getByTestId("selected")).toHaveTextContent("unknown-rect");
      expect(screen.getByTestId("state")).toHaveTextContent('"coordinates"');
      expect(screen.getByTestId("history")).toHaveTextContent("1");
      expect(screen.getByTestId("saved")).toHaveTextContent("unknown-rect");
    });
  });

  it("handles coordinate updates with partial and absent coordinates", async () => {
    const { rerender } = render(
      <Harness
        key="only-x"
        initial={component("AudioComponent", { id: "audio-only-x" })}
      />,
    );
    fireEvent.click(screen.getByTestId("visual-AudioComponent-audio-only-x"));

    await waitFor(() => {
      expect(screen.getByTestId("state")).toHaveTextContent('"x":310');
      expect(screen.getByTestId("state")).toHaveTextContent('"y":22');
    });

    rerender(
      <Harness
        key="only-y"
        initial={component("AudioComponent", { id: "audio-only-y" })}
      />,
    );
    fireEvent.click(screen.getByTestId("visual-AudioComponent-audio-only-y"));

    await waitFor(() => {
      expect(screen.getByTestId("state")).toHaveTextContent('"x":11');
      expect(screen.getByTestId("state")).toHaveTextContent('"y":410');
    });

    rerender(
      <Harness
        key="size-only"
        initial={component("AudioComponent", { id: "audio-size-only" })}
      />,
    );
    fireEvent.click(
      screen.getByTestId("visual-AudioComponent-audio-size-only"),
    );

    await waitFor(() => {
      expect(screen.getByTestId("state")).toHaveTextContent('"width"');
      expect(screen.getByTestId("state")).not.toHaveTextContent(
        '"coordinates"',
      );
    });
  });

  it("covers default rectangle branches without autosave and unselected text", async () => {
    const { rerender } = render(
      <Harness
        key="rect-no-save"
        initial={component("UnknownComponent", { id: "rect-no-save" })}
        withAutoSave={false}
      />,
    );

    fireEvent.click(screen.getByText("drag rect"));

    await waitFor(() => {
      expect(screen.getByTestId("state")).toHaveTextContent('"coordinates"');
      expect(screen.getByTestId("saved")).toHaveTextContent("none");
    });

    rerender(
      <Harness
        key="text-not-selected"
        initial={component("TextComponent", { id: "text-not-selected" })}
        withAutoSave={false}
      />,
    );

    expect(screen.getByTestId("rect-text-not-selected")).toBeInTheDocument();
  });
});
