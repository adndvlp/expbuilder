import { afterEach, describe, expect, it } from "vitest";
import { getApiBaseUrl } from "../../lib/apiBaseUrl";

describe("getApiBaseUrl", () => {
  afterEach(() => {
    delete (window as any).electron;
  });

  it("uses the Electron-provided URL when the preload bridge is present", () => {
    (window as any).electron = {
      getApiBaseUrl: () => "http://localhost:3007/",
    };
    expect(getApiBaseUrl()).toBe("http://localhost:3007");
  });

  it("falls back to the Vite API URL outside Electron", () => {
    expect(getApiBaseUrl()).toBe("http://localhost:3000");
  });

  it("ignores an empty Electron URL and uses the Vite fallback", () => {
    (window as any).electron = {
      getApiBaseUrl: () => "",
    };
    expect(getApiBaseUrl()).toBe("http://localhost:3000");
  });
});
