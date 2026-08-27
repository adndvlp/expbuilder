import { describe, expect, it, vi } from "vitest";

import { createPrecisionComponentLifecycle } from "../components/PrecisionComponent";

describe("PrecisionComponent lifecycle adapter", () => {
  it("awaits asynchronous component render before arming or activating", async () => {
    let release!: (element: HTMLElement) => void;
    const renderResult = new Promise<HTMLElement>((resolve) => {
      release = resolve;
    });
    const instance = {
      render: vi.fn(() => renderResult),
      arm: vi.fn(),
      activate: vi.fn(),
      hide: vi.fn(),
      destroy: vi.fn(),
    };
    const lifecycle = createPrecisionComponentLifecycle(instance);
    const preparation = lifecycle.prepare(document.body, {}, vi.fn());

    lifecycle.arm();
    lifecycle.activate({ timestamp: 10 });
    expect(instance.arm).not.toHaveBeenCalled();
    expect(instance.activate).not.toHaveBeenCalled();

    const element = document.createElement("div");
    release(element);
    await expect(preparation).resolves.toBe(element);

    lifecycle.arm();
    lifecycle.activate({ timestamp: 16.667 });
    lifecycle.deactivate({ timestamp: 66.667 });
    expect(instance.arm).toHaveBeenCalledTimes(1);
    expect(instance.activate).toHaveBeenCalledWith({ timestamp: 16.667 });
    expect(instance.hide).toHaveBeenCalledTimes(1);
  });

  it("destroys a component exactly once", async () => {
    const instance = {
      render: vi.fn(() => document.createElement("div")),
      destroy: vi.fn(),
    };
    const lifecycle = createPrecisionComponentLifecycle(instance);
    await lifecycle.prepare(document.body, {}, vi.fn());
    lifecycle.destroy();
    lifecycle.destroy();
    expect(instance.destroy).toHaveBeenCalledTimes(1);
  });

  it("passes the observed boundary timestamp to an explicit deactivate hook", async () => {
    const instance = {
      render: vi.fn(() => document.createElement("div")),
      deactivate: vi.fn(),
      hide: vi.fn(),
    };
    const lifecycle = createPrecisionComponentLifecycle(instance);
    await lifecycle.prepare(document.body, {}, vi.fn());

    lifecycle.deactivate({ timestamp: 50 });

    expect(instance.deactivate).toHaveBeenCalledWith({ timestamp: 50 });
    expect(instance.hide).not.toHaveBeenCalled();
  });
});
