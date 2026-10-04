import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCanvasStages } from "../../../../server/dynamicplugin/renderer/CanvasStage";
import { createGpuHarness } from "./testHarness/gpu";

describe("Dynamic GPU resource lifetime", () => {
  let gpu: ReturnType<typeof createGpuHarness>;
  beforeEach(() => {
    gpu = createGpuHarness();
  });
  afterEach(() => {
    for (const stage of getCanvasStages(gpu.parent)) stage.destroy();
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("destroys GPU resources, callbacks, canvas storage and registry exactly once", () => {
    const stage = gpu.createStage();
    stage.preloadTexture("first", gpu.source());
    stage.registerSprite(gpu.sprite("first", "first"));
    stage.setTrialActive(true);
    stage.commit(1, true);
    const onCommit = vi.fn();
    stage.setDrawableVisibility("first", false, onCommit);
    expect(gpu.counts().query).toBe(1);

    stage.destroy();
    stage.destroy();

    expect(gpu.live.size).toBe(0);
    expect(gpu.loseContext).toHaveBeenCalledTimes(1);
    expect(stage.canvas.width).toBe(0);
    expect(stage.canvas.height).toBe(0);
    expect(stage.canvas.isConnected).toBe(false);
    expect(getCanvasStages(gpu.parent)).toEqual([]);
    expect(stage.commit(2, true)).toBeNull();
    expect(onCommit).not.toHaveBeenCalled();
    expect(stage.getMetrics().gpu_pending_query_count).toBe(0);
    expect(gpu.gl.deleteProgram).toHaveBeenCalledTimes(1);
    expect(gpu.gl.deleteBuffer).toHaveBeenCalledTimes(2);
  });

  it("rejects late work on a destroyed stage and permits a new stage on the same parent", () => {
    const stage = gpu.createStage();
    stage.destroy();
    const uploads = gpu.gl.createTexture.mock.calls.length;
    expect(stage.preloadTexture("late", gpu.source())).toBeNull();
    stage.registerSprite(gpu.sprite("late", "late"));
    stage.resize(800, 600);
    stage.resetForTrial();
    stage.setTrialActive(true);
    stage.render();
    expect(stage.commit(3, true)).toBeNull();
    expect(gpu.gl.createTexture).toHaveBeenCalledTimes(uploads);
    expect(stage.canvas.width).toBe(0);
    const replacement = gpu.createStage();
    expect(replacement).not.toBe(stage);
    expect(getCanvasStages(gpu.parent)).toEqual([replacement]);
  });

  it("retains a shared texture until its last user leaves and a replacement frame commits", () => {
    const stage = gpu.createStage();
    const source = gpu.source();
    stage.preloadTexture("shared", source);
    const removeFirst = stage.registerSprite(gpu.sprite("a", "shared"));
    const removeSecond = stage.registerSprite(gpu.sprite("b", "shared"));
    stage.commit(1, true);
    removeFirst();
    stage.commit(2, true);
    expect(gpu.gl.createTexture).toHaveBeenCalledTimes(2);
    expect(gpu.gl.deleteTexture).not.toHaveBeenCalled();
    expect(gpu.gl.drawArrays).toHaveBeenCalledTimes(3);
    removeSecond();
    expect(gpu.gl.deleteTexture).not.toHaveBeenCalled();
    stage.commit(3, true);
    expect(gpu.gl.deleteTexture).toHaveBeenCalledTimes(1);
    expect(source.close).not.toHaveBeenCalled();
    expect(gpu.loseContext).not.toHaveBeenCalled();
  });

  it("keeps the previous frame's texture until the following trial commits", () => {
    const stage = gpu.createStage();
    stage.preloadTexture("previous", gpu.source());
    const remove = stage.registerSprite(gpu.sprite("previous", "previous"));
    stage.commit(1, true);
    remove();
    stage.resetForTrial();
    stage.preloadTexture("next", gpu.source());
    stage.registerSprite(gpu.sprite("next", "next"));
    expect(gpu.gl.deleteTexture).not.toHaveBeenCalled();
    stage.commit(2, true);
    expect(gpu.gl.deleteTexture).toHaveBeenCalledTimes(1);
    expect(gpu.counts().texture).toBe(2);
    expect(gpu.loseContext).not.toHaveBeenCalled();
  });

  it("reuses the same texture across repeated trials", () => {
    const stage = gpu.createStage();
    const source = gpu.source();
    for (let index = 0; index < 30; index++) {
      stage.resetForTrial();
      stage.preloadTexture("same", source);
      const remove = stage.registerSprite(gpu.sprite("same", "same"));
      stage.commit(index, true);
      remove();
    }
    expect(gpu.gl.createTexture).toHaveBeenCalledTimes(2);
    expect(gpu.counts().texture).toBe(2);
    expect(gpu.loseContext).not.toHaveBeenCalled();
  });

  it("bounds retained textures and sources across many distinct trials", () => {
    const stage = gpu.createStage();
    for (let index = 0; index < 30; index++) {
      stage.resetForTrial();
      stage.preloadTexture(String(index), gpu.source());
      stage.registerSprite(gpu.sprite(String(index), String(index)));
      stage.commit(index, true);
      expect(gpu.counts().texture).toBe(2);
      expect(gpu.counts().query).toBe(1);
      expect(stage.getMetrics().gpu_timer_available).toBe(true);
    }
    // An old source must not be resurrected from the stage's source registry.
    stage.resetForTrial();
    stage.registerSprite(gpu.sprite("old", "0"));
    stage.commit(31, true);
    expect(stage.getMetrics().draw_call_count).toBe(0);
    expect(gpu.counts().texture).toBe(1);
    stage.destroy();
    expect(gpu.live.size).toBe(0);
  });

  it("does not request context restoration after an intentional disposal", () => {
    const stage = gpu.createStage();
    stage.destroy();
    const event = new Event("webglcontextlost", { cancelable: true });
    stage.canvas.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(stage.getMetrics().webgl_context_lost_count).toBe(0);
  });

  it("disposes without the context-loss extension", () => {
    gpu.gl.getExtension.mockReturnValue(null);
    const stage = gpu.createStage();
    stage.destroy();
    expect(gpu.live.size).toBe(0);
    expect(stage.canvas.width).toBe(0);
    expect(gpu.loseContext).not.toHaveBeenCalled();
  });

  it("does not lose an already lost context again", () => {
    const stage = gpu.createStage();
    gpu.gl.isContextLost.mockReturnValue(true);
    stage.destroy();
    expect(gpu.live.size).toBe(0);
    expect(gpu.loseContext).not.toHaveBeenCalled();
  });

  it("retains prepared hidden sprites until their scheduled onset", () => {
    const stage = gpu.createStage();
    stage.preloadTexture("later", gpu.source());
    stage.registerSprite({ ...gpu.sprite("later", "later"), visible: false });
    stage.commit(1, true);
    expect(gpu.gl.deleteTexture).not.toHaveBeenCalled();
    stage.setDrawableVisibility("later", true);
    stage.commit(2, true);
    expect(gpu.gl.createTexture).toHaveBeenCalledTimes(2);
    expect(gpu.gl.drawArrays).toHaveBeenCalledTimes(1);
  });

  it("preserves the valid texture and frees a failed replacement upload", () => {
    const stage = gpu.createStage();
    stage.preloadTexture("image", gpu.source());
    stage.registerSprite(gpu.sprite("image", "image"));
    stage.commit(1, true);
    gpu.gl.texImage2D.mockImplementationOnce(() => {
      throw new Error("Invalid image source");
    });
    expect(() => stage.preloadTexture("image", gpu.source())).toThrow(
      "Invalid image source",
    );
    expect(gpu.counts().texture).toBe(2);
    stage.render();
    expect(gpu.gl.drawArrays).toHaveBeenCalledTimes(2);
    stage.destroy();
    expect(gpu.live.size).toBe(0);
  });

  it.each(["shader", "program", "texture"] as const)(
    "releases partially initialized resources when %s creation fails",
    (failure) => {
      if (failure === "shader")
        gpu.gl.getShaderParameter
          .mockReturnValueOnce(true)
          .mockReturnValueOnce(false);
      if (failure === "program")
        gpu.gl.getProgramParameter.mockReturnValue(false);
      if (failure === "texture") gpu.gl.createTexture.mockReturnValueOnce(null);
      expect(() => gpu.createStage()).toThrow();
      expect(gpu.live.size).toBe(0);
      expect(gpu.parent.querySelectorAll("canvas")).toHaveLength(0);
      expect(getCanvasStages(gpu.parent)).toEqual([]);
    },
  );

  it("removes the canvas when WebGL is unavailable", () => {
    const implementation = gpu.getContext.getMockImplementation()!;
    gpu.getContext.mockImplementation(((type: string, ...args: unknown[]) =>
      type === "2d"
        ? Reflect.apply(implementation, null, [type, ...args])
        : null) as typeof HTMLCanvasElement.prototype.getContext);
    expect(() => gpu.createStage()).toThrow("WebGL is not available");
    expect(gpu.parent.querySelectorAll("canvas")).toHaveLength(0);
  });
});
