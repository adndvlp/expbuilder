import type { Page } from "@playwright/test";

export async function installBitmapLifetimeProbe(page: Page) {
  await page.addInitScript(() => {
    const bitmaps = new Map<ImageBitmap, { id: number; closed: boolean }>();
    const create = window.createImageBitmap.bind(window);
    window.createImageBitmap = (async (...args: unknown[]) => {
      const bitmap = (await Reflect.apply(create, window, args)) as ImageBitmap;
      bitmaps.set(bitmap, { id: bitmaps.size + 1, closed: false });
      return bitmap;
    }) as typeof window.createImageBitmap;
    const close = ImageBitmap.prototype.close;
    ImageBitmap.prototype.close = function () {
      const entry = bitmaps.get(this);
      if (entry) entry.closed = true;
      return close.call(this);
    };
    Object.defineProperty(window, "__bitmapInventory", {
      value: () =>
        [...bitmaps].map(([bitmap, entry]) => ({
          ...entry,
          width: bitmap.width,
          height: bitmap.height,
        })),
    });
  });
}

export const bitmapInventory = (page: Page) =>
  page.evaluate(() =>
    (
      window as unknown as {
        __bitmapInventory(): {
          id: number;
          closed: boolean;
          width: number;
          height: number;
        }[];
      }
    ).__bitmapInventory(),
  );
