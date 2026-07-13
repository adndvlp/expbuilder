import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  installTrialsContext,
  loopTimeline,
  makeLoop,
  makeTrial,
  mocks,
  renderSubCanvas,
  setupSubCanvasTest,
} from "./testHarness";

describe("SubCanvas container", () => {
  beforeEach(setupSubCanvasTest);

  it("adds a branch or parent from the add-trial modal and refreshes metadata", async () => {
    const props = renderSubCanvas();

    await act(async () => {
      await mocks.generateProps.onAddBranch(1);
    });
    fireEvent.click(screen.getByText("Add as branch"));

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(
        1,
        { branches: [2, 99] },
        expect.objectContaining({ id: 99 }),
      );
    });
    expect(props.onRefreshMetadata).toHaveBeenCalled();

    vi.clearAllMocks();
    installTrialsContext();
    renderSubCanvas();

    await act(async () => {
      await mocks.generateProps.onAddBranch(1);
    });
    fireEvent.click(screen.getByText("Add as parent"));

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(
        1,
        { branches: [99] },
        expect.objectContaining({ id: 99, branches: [2] }),
      );
    });
  });

  it("keeps zero-valued parent ids usable in the add-trial modal", async () => {
    const zeroTimeline = [
      { id: 0, type: "trial", name: "Zero Parent", branches: [1] },
      ...loopTimeline,
    ];
    installTrialsContext({
      getTrial: vi.fn(async (id: number | string) =>
        id === 0
          ? makeTrial(0, { name: "Zero Parent", branches: [1] })
          : makeTrial(Number(id), { branches: id === 1 ? [2] : [] }),
      ),
    });
    renderSubCanvas({ loopTimeline: zeroTimeline });

    await act(async () => {
      await mocks.generateProps.onAddBranch(0);
    });

    expect(screen.getByTestId("sub-add-trial-modal")).toHaveTextContent(
      "Zero Parent",
    );
    fireEvent.click(screen.getByText("Add as branch"));

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(
        0,
        { branches: [1, 99] },
        expect.objectContaining({ id: 99 }),
      );
    });
  });

  it("reuses an existing current-loop breadcrumb and renders the dark surface", () => {
    const { container } = renderSubCanvas({
      isDark: true,
      loopStack: [{ id: "loop-main", name: "Main Loop" }],
    });

    expect(screen.getByText("Main Loop")).toBeInTheDocument();
    expect(
      (container.firstElementChild as HTMLElement).style.background,
    ).toContain("rgb(35, 39, 47)");
  });

  it("uses a selected loop for branching and nested-loop selection", () => {
    const zeroLoop = makeLoop("loop-new", {
      id: 0,
      name: "Zero Loop",
    }) as any;
    renderSubCanvas({
      loopTimeline: [
        { id: 0, type: "loop", name: "Zero Loop", branches: [] },
        ...loopTimeline,
      ],
      selectedTrial: null,
      selectedLoop: zeroLoop,
    });

    fireEvent.click(screen.getByTitle("Branches"));
    expect(screen.getByTestId("sub-branch-modal")).toHaveTextContent(
      "Zero Loop",
    );
    fireEvent.click(screen.getByText("Close Branch Modal"));

    fireEvent.click(screen.getByTitle("Create Nested Loop"));
    expect(
      screen.getByText("Select trials/loops for loop"),
    ).toBeInTheDocument();
  });

  it("adds a branch without metadata callbacks when branches are omitted", async () => {
    const sparseTimeline = [{ id: 3, type: "trial", name: "Trial 3" }];
    installTrialsContext({
      getTrial: vi.fn(async () => makeTrial(3, { branches: undefined })),
    });
    renderSubCanvas({
      loopTimeline: sparseTimeline as any,
      onRefreshMetadata: undefined,
    });

    await act(async () => {
      await mocks.generateProps.onAddBranch(3);
    });

    expect(mocks.trialsContext.createTrial).toHaveBeenCalled();
    expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(
      3,
      { branches: [99] },
      expect.objectContaining({ id: 99 }),
    );
  });
});
