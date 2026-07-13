import grapesjs from "grapesjs";
import { vi } from "vitest";

export type EditorMock = ReturnType<typeof createEditorMock>;

export function createEditorMock() {
  const handlers: Record<string, () => void> = {};
  const canvasBody = document.createElement("body");
  const canvasWrapper = document.createElement("div");
  canvasWrapper.id = "wrapper";
  canvasBody.appendChild(canvasWrapper);
  const blockManager = {
    add: vi.fn(),
    remove: vi.fn(),
    get: vi.fn((id: string) => ({ id })),
    getAll: vi.fn(() => [{ id: "column1" }, { id: "image" }]),
  };
  return {
    handlers,
    canvasBody,
    canvasWrapper,
    Canvas: { getBody: vi.fn(() => canvasBody) },
    BlockManager: blockManager,
    getHtml: vi.fn(() => "<body><div>Saved</div></body>"),
    getCss: vi.fn(() => ".saved{color:red;}"),
    destroy: vi.fn(),
    on: vi.fn((event: string, cb: () => void) => {
      handlers[event] = cb;
    }),
  };
}

export function mockNextEditor(editor: EditorMock) {
  vi.mocked(grapesjs.init).mockReturnValue(editor as any);
}
