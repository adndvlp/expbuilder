import { afterEach, describe, expect, it, vi } from "vitest";
import { BaseStage, StageCommitInfo } from "../renderer/CanvasStage";

class FakeStage extends BaseStage {
  renderedFrames: number[] = [];
  eventLog: string[] = [];
  lastRenderedDrawableIds: string[] = [];

  constructor(parent: HTMLElement, options: any = {}) {
    super(parent, options, "fake", "fake-retained");
  }

  preloadTexture(_key: string, _source: any): string | null {
    return "texture";
  }

  protected renderFrame(timestamp: number): number {
    this.renderedFrames.push(timestamp);
    this.eventLog.push("renderFrame");
    this.lastRenderedDrawableIds = this.getOrderedDrawables().map(
      (drawable) => drawable.id,
    );
    return 0;
  }
}

function createStage() {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const stage = new FakeStage(parent, { width: 1024, height: 768 });
  return { stage, parent };
}

describe("CanvasStage baseline characterization", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("render() while inactive commits immediately", () => {
    const { stage } = createStage();
    stage.render();
    const metrics = stage.getMetrics();
    expect(metrics.commit_count).toBe(1);
  });

  it("render() while trialActive only marks dirty, no immediate commit", () => {
    const { stage } = createStage();
    stage.setTrialActive(true);
    stage.render();
    const metrics = stage.getMetrics();
    expect(metrics.commit_count).toBe(0);
    // the next frame-synced commit performs the draw
    const info = stage.commit(100, true);
    expect(info).not.toBeNull();
    expect(stage.getMetrics().commit_count).toBe(1);
  });

  it("clean commit returns null without drawing", () => {
    const { stage } = createStage();
    stage.render();
    const drawsBefore = stage.renderedFrames.length;
    const info = stage.commit(200, true);
    expect(info).toBeNull();
    expect(stage.renderedFrames.length).toBe(drawsBefore);
  });

  it("dirty frame-synced commit increments the count exactly once", () => {
    const { stage } = createStage();
    stage.setTrialActive(true);
    stage.setDrawableVisibility("missing", true); // no-op for missing id
    stage.render();
    const info = stage.commit(300, true);
    expect(info).not.toBeNull();
    expect(stage.getMetrics().commit_count).toBe(1);
    expect(stage.commit(301, true)).toBeNull();
    expect(stage.getMetrics().commit_count).toBe(1);
  });

  it("visibility callback fires after renderFrame completes", () => {
    const { stage } = createStage();
    stage.setTrialActive(true);
    stage.registerSprite({
      id: "s1",
      textureKey: "k",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      visible: false,
    });
    const commitLog: string[] = [];
    stage.setDrawableVisibility("s1", true, (info: StageCommitInfo) => {
      commitLog.push(`callback:${info.timestamp}`);
    });
    stage.render();
    stage.commit(400, true);
    expect(stage.eventLog).toEqual(["renderFrame"]);
    expect(commitLog).toEqual(["callback:400"]);
    expect(stage.eventLog.indexOf("renderFrame")).toBeLessThan(
      commitLog.length + 1,
    );
  });

  it.each([
    { initial: true, requested: true, label: "show when already visible" },
    { initial: false, requested: false, label: "hide when already hidden" },
  ])("does not defer a callback for $label", ({ initial, requested }) => {
    const { stage } = createStage();
    stage.setTrialActive(true);
    stage.registerSprite({
      id: "s1",
      textureKey: "k",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      visible: initial,
    });
    const callback = vi.fn();
    stage.setDrawableVisibility("s1", requested, callback);
    stage.render();
    stage.commit(410, true);
    expect(callback).not.toHaveBeenCalled();
  });

  it("attributes show/show and hide/hide only to their real commits", () => {
    const { stage } = createStage();
    stage.setTrialActive(true);
    stage.registerSprite({
      id: "s1",
      textureKey: "k",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      visible: false,
    });
    const firstShow = vi.fn();
    const secondShow = vi.fn();
    stage.setDrawableVisibility("s1", true, firstShow);
    stage.setDrawableVisibility("s1", true, secondShow);
    stage.commit(420, true);
    expect(firstShow).toHaveBeenCalledTimes(1);
    expect(secondShow).not.toHaveBeenCalled();

    const firstHide = vi.fn();
    const secondHide = vi.fn();
    stage.setDrawableVisibility("s1", false, firstHide);
    stage.setDrawableVisibility("s1", false, secondHide);
    stage.commit(430, true);
    expect(firstHide).toHaveBeenCalledTimes(1);
    expect(secondHide).not.toHaveBeenCalled();
  });

  it("StageCommitInfo.frameTimestamp equals the supplied commit timestamp", () => {
    const { stage } = createStage();
    stage.setTrialActive(true);
    stage.registerSprite({
      id: "s1",
      textureKey: "k",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      visible: false,
    });
    let info: StageCommitInfo | null = null;
    stage.setDrawableVisibility("s1", true, (commitInfo) => {
      info = commitInfo;
    });
    stage.commit(1234.5, true);
    expect(info?.frameTimestamp).toBe(1234.5);
    expect(info?.timestamp).toBe(1234.5);
  });

  it("CPU commit start/end are ordered and duration matches their difference", () => {
    const { stage } = createStage();
    stage.setTrialActive(true);
    stage.registerSprite({
      id: "s1",
      textureKey: "k",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      visible: false,
    });
    const now = vi.spyOn(performance, "now");
    let call = 0;
    now.mockImplementation(() => {
      call += 1;
      return call === 1 ? 100 : 104.25;
    });
    stage.setDrawableVisibility("s1", true);
    const info = stage.commit(500, true);
    expect(info).not.toBeNull();
    expect(info!.cpuCommitStartedAt).toBe(100);
    expect(info!.cpuCommitEndedAt).toBe(104.25);
    expect(info!.cpuCommitStartedAt).toBeLessThanOrEqual(
      info!.cpuCommitEndedAt,
    );
    expect(info!.commitDuration).toBe(4.25);
  });

  it("uses online commit statistics without retaining a production series", () => {
    const { stage } = createStage();
    const now = vi.spyOn(performance, "now");
    now
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(12)
      .mockReturnValueOnce(18)
      .mockReturnValueOnce(20)
      .mockReturnValueOnce(26);
    stage.commit(100, true);
    stage.render();
    stage.commit(116.667, true);
    const metrics = stage.getMetrics();
    expect(metrics.commit_count).toBe(2);
    expect(metrics.mean_commit_duration).toBe(4);
    expect(metrics.max_commit_duration).toBe(6);
    expect(metrics.commit_durations).toEqual([]);
  });

  it("bounds debug commit series and reports truncation", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const stage = new FakeStage(parent, {
      width: 1024,
      height: 768,
      recordCommitSeries: true,
    });
    for (let index = 0; index < 4100; index++) {
      stage.render();
    }
    const metrics = stage.getMetrics();
    expect(metrics.commit_count).toBe(4100);
    expect(metrics.commit_durations).toHaveLength(4096);
    expect(metrics.commit_series_truncated).toBe(true);
  });

  it("unsynced active commit increments canonical and alias metrics", () => {
    const { stage } = createStage();
    stage.setTrialActive(true);
    stage.registerSprite({
      id: "s1",
      textureKey: "k",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      visible: false,
    });
    stage.setDrawableVisibility("s1", true);
    stage.commit(600, false);
    const metrics = stage.getMetrics();
    expect(metrics.visual_all_commits_frame_synced).toBe(false);
    expect(metrics.commit_unsynced_count).toBe(1);
    expect(metrics.visual_all_commits_rAF).toBe(false);
    expect(metrics.commit_outside_raf_count).toBe(1);
  });

  it("no-dirty fast path performs no draw", () => {
    const { stage } = createStage();
    stage.render();
    const drawsBefore = stage.renderedFrames.length;
    stage.commit(700, true);
    expect(stage.renderedFrames.length).toBe(drawsBefore);
  });

  it("does not scan prepared hidden drawables in the frame render path", () => {
    const { stage } = createStage();
    stage.setTrialActive(true);
    for (let index = 0; index < 1000; index++) {
      stage.registerSprite({
        id: `prepared-${index}`,
        textureKey: `texture-${index}`,
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        visible: false,
      });
    }
    stage.setDrawableVisibility("prepared-17", true);
    stage.setDrawableVisibility("prepared-923", true);

    stage.commit(800, true);

    expect(stage.lastRenderedDrawableIds).toEqual([
      "prepared-17",
      "prepared-923",
    ]);
  });
});
