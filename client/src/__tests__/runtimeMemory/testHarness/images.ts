import { vi } from "vitest";

export function controlledImages() {
  const images: ControlledImage[] = [];
  class ControlledImage {
    src = "";
    complete = false;
    naturalWidth = 0;
    naturalHeight = 0;
    onload: ((event: Event) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    removeAttribute = vi.fn(() => {
      this.src = "";
    });
    constructor() {
      images.push(this);
    }
    load() {
      this.complete = true;
      this.naturalWidth = this.naturalHeight = 2;
      this.onload?.(new Event("load"));
    }
    fail() {
      this.onerror?.(new Event("error"));
    }
  }
  vi.stubGlobal("Image", ControlledImage);
  return images;
}

export function testBitmap() {
  return { width: 2, height: 2, close: vi.fn() } as unknown as ImageBitmap;
}
