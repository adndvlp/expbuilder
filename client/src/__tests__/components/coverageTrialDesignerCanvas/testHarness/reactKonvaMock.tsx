import { vi } from "vitest";

vi.mock("konva", () => ({ default: {} }));

vi.mock("react-konva", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  function nodeApi(props: any) {
    let scaleX = 1.5;
    let scaleY = 1.4;
    return {
      x: () => (props.x ?? 0) + 12,
      y: () => (props.y ?? 0) + 18,
      rotation: () => (props.rotation ?? 0) + 5,
      scaleX: (next?: number) => {
        if (next !== undefined) scaleX = next;
        return scaleX;
      },
      scaleY: (next?: number) => {
        if (next !== undefined) scaleY = next;
        return scaleY;
      },
    };
  }

  const Group = React.forwardRef<any, any>((props, ref) => {
    const node = nodeApi(props);
    React.useImperativeHandle(ref, () => node);
    const event = { target: node };
    return (
      <div data-testid={`konva-group-${props.x}-${props.y}`}>
        <button onClick={props.onClick}>select group</button>
        <button
          onClick={() =>
            props.onDblClick?.({
              cancelBubble: false,
              evt: { preventDefault: vi.fn() },
            })
          }
        >
          double group
        </button>
        <button onClick={() => props.onDragMove?.(event)}>drag move</button>
        <button onClick={() => props.onDragEnd?.(event)}>drag end</button>
        <button onClick={() => props.onTransformEnd?.()}>transform end</button>
        {props.children}
      </div>
    );
  });
  Group.displayName = "MockKonvaGroup";

  const Transformer = React.forwardRef<any, any>((props, ref) => {
    React.useImperativeHandle(ref, () => ({
      nodes: vi.fn(),
      getLayer: () => ({ batchDraw: vi.fn() }),
    }));
    return (
      <div data-testid="konva-transformer">
        <button
          onClick={() =>
            props.boundBoxFunc?.(
              { width: 40, height: 40 },
              { width: 5, height: 5 },
            )
          }
        >
          bound small
        </button>
        <button
          onClick={() =>
            props.boundBoxFunc?.(
              { width: 40, height: 40 },
              { width: 60, height: 60 },
            )
          }
        >
          bound large
        </button>
      </div>
    );
  });
  Transformer.displayName = "MockKonvaTransformer";

  const Rect = (props: any) => {
    const node = nodeApi(props);
    return (
      <button
        data-testid={`konva-rect-${props.id ?? "background"}`}
        onClick={props.onClick}
        onDragEnd={() => props.onDragEnd?.({ target: node })}
      >
        rect {props.id ?? "background"}
      </button>
    );
  };

  const Stage = React.forwardRef<any, any>((props, ref) => {
    const stageTarget: any = { getStage: () => stageTarget };
    React.useImperativeHandle(ref, () => stageTarget);
    return (
      <div data-testid="konva-stage">
        <button onClick={() => props.onClick?.({ target: stageTarget })}>
          clear stage
        </button>
        <button
          onClick={() =>
            props.onClick?.({ target: { getStage: () => stageTarget } })
          }
        >
          child stage click
        </button>
        {props.children}
      </div>
    );
  });
  Stage.displayName = "MockKonvaStage";

  return {
    Stage,
    Layer: ({ children }: any) => (
      <div data-testid="konva-layer">{children}</div>
    ),
    Rect,
    Group,
    Transformer,
  };
});
