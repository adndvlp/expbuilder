import { afterEach, describe, expect, it, vi } from "vitest";
import { BaseStage, StageCommitInfo } from "../renderer/CanvasStage";

class FakeStage extends BaseStage {
  renderedFrames: number[] = [];
  eventLog: string[] = [];

  constructor(parent: HTMLElement, options: any = {}) {
    super(parent, options, "fake", "fake-retained");
  }

  preloadTexture(_key: string, _source: any): string | null {
    return "texture";
  }

  protected renderFrame(timestamp: number): number {
    this.renderedFrames.push(timestamp);
    this.eventLog.push("renderFrame");
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
    expect(stage.eventLog.indexOf("renderFrame")).toBeLessThan(commitLog.length + 1);
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
    expect(info!.cpuCommitStartedAt).toBeLessThanOrEqual(info!.cpuCommitEndedAt);
    expect(info!.commitDuration).toBe(4.25);
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
});
