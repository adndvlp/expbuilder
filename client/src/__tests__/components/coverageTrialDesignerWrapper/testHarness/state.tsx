import { vi } from "vitest";

const wrapperMocks = vi.hoisted(() => ({
  handleDrop: vi.fn(),
  renderComponent: vi.fn(({ comp }: any) => (
    <div data-testid="render-component">{comp.id}</div>
  )),
  initialComponents: undefined as any[] | undefined,
  initialSelectedId: undefined as string | null | undefined,
}));

export { wrapperMocks };
