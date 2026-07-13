import { vi } from "vitest";
import { konvaMockState } from "./mockState";

vi.mock("react-konva", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  function createNode(props: any) {
    let x = props.x ?? 20;
    let y = props.y ?? 30;
    let width = props.width ?? 120;
    let height = props.height ?? 60;
    let scaleX = konvaMockState.scaleX;
    let scaleY = konvaMockState.scaleY;
    let rotation = props.rotation ?? 7;
    return {
      x: (next?: number) => {
        if (next !== undefined) x = next;
        return x + 10;
      },
      y: (next?: number) => {
        if (next !== undefined) y = next;
        return y + 12;
      },
      width: (next?: number) => {
        if (next !== undefined) width = next;
        return width;
      },
      height: (next?: number) => {
        if (next !== undefined) height = next;
        return height;
      },
      scaleX: (next?: number) => {
        if (next !== undefined) scaleX = next;
        return scaleX;
      },
      scaleY: (next?: number) => {
        if (next !== undefined) scaleY = next;
        return scaleY;
      },
      rotation: (next?: number) => {
        if (next !== undefined) rotation = next;
        return rotation;
      },
      offsetX: vi.fn(),
      offsetY: vi.fn(),
      getLayer: () => ({ batchDraw: vi.fn() }),
    };
  }

  const eventFor = (node: any) => ({
    target: node,
    cancelBubble: false,
    evt: { preventDefault: vi.fn() },
  });

  const mockElement = (name: string) =>
    React.forwardRef<any, any>((props, ref) => {
      const node = createNode(props);
      React.useImperativeHandle(ref, () =>
        konvaMockState.nullRefNames.has(name) ? null : node,
      );
      const event = eventFor(node);
      return (
        <div data-testid={`konva-${name}`}>
          <button onClick={() => props.onClick?.(event)}>{name} click</button>
          <button onClick={() => props.onTap?.(event)}>{name} tap</button>
          <button onClick={() => props.onDblClick?.(event)}>
            {name} double
          </button>
          <button onClick={() => props.onDragMove?.(event)}>
            {name} drag move
          </button>
          <button onClick={() => props.onDragEnd?.(event)}>
            {name} drag end
          </button>
          <button onClick={() => props.onTransform?.(event)}>
            {name} transform
          </button>
          <button onClick={() => props.onTransformEnd?.(event)}>
            {name} transform end
          </button>
          {props.text && <span>{props.text}</span>}
          {props.children}
        </div>
      );
    });

  const Transformer = React.forwardRef<any, any>((props, ref) => {
    React.useImperativeHandle(ref, () => ({
      nodes: vi.fn(),
      getLayer: () => ({ batchDraw: vi.fn() }),
      getActiveAnchor: () => konvaMockState.activeAnchor,
    }));
    return (
      <div data-testid="konva-Transformer">
        <button
          onClick={() =>
            props.boundBoxFunc?.(
              { width: 60, height: 40 },
              { width: 2, height: 2 },
            )
          }
        >
          Transformer bound small
        </button>
        <button
          onClick={() =>
            props.boundBoxFunc?.(
              { width: 60, height: 40 },
              { width: 200, height: 2 },
            )
          }
        >
          Transformer bound short
        </button>
        <button
          onClick={() =>
            props.boundBoxFunc?.(
              { width: 60, height: 40 },
              { width: 200, height: 120 },
            )
          }
        >
          Transformer bound large
        </button>
      </div>
    );
  });

  return {
    Image: mockElement("Image"),
    Rect: mockElement("Rect"),
    Text: mockElement("Text"),
    Group: mockElement("Group"),
    Line: mockElement("Line"),
    Circle: mockElement("Circle"),
    Transformer,
  };
});
