import { Position } from "@xyflow/react";
import NavigationRoutingEdge from "../components/NavigationRoutingEdge";
export default function WorkspaceEdge(props) {
  return (
    <>
      <NavigationRoutingEdge {...props} />
      {props.selected &&
        props.data.canReconnect &&
        ["source", "target"].map((end) => {
          const position = props[end + "Position"],
            label =
              end === "source"
                ? "Drag to change parent"
                : "Drag to change destination";
          const x =
              props[end + "X"] +
              (position === Position.Left
                ? -14
                : position === Position.Right
                  ? 14
                  : 0),
            y =
              props[end + "Y"] +
              (position === Position.Top
                ? -14
                : position === Position.Bottom
                  ? 14
                  : 0);
          return (
            <g
              key={end}
              className="edge-reconnect-icon"
              role="img"
              aria-label={label}
              transform={`translate(${x} ${y})`}
            >
              <title>{label}</title>
              <rect
                x="-12"
                y="-12"
                width="24"
                height="24"
                rx="6"
                fill="#f1c40f"
                stroke="#fff"
                strokeWidth="1.2"
              />
              <path
                d="M0 -8V8M-8 0H8M-3 -5L0 -8L3 -5M-3 5L0 8L3 5M-5 -3L-8 0L-5 3M5 -3L8 0L5 3"
                fill="none"
                stroke="#fff"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          );
        })}
    </>
  );
}
