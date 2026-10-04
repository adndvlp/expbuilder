import { useEffect, useLayoutEffect, useRef } from "react";

export function useTransientDrag(
  onChange: (attrs: { x: number; y: number; __transient: true }) => void,
) {
  const latest = useRef(onChange);
  useLayoutEffect(() => {
    latest.current = onChange;
  }, [onChange]);
  const pending = useRef<{ x: number; y: number } | null>(null);
  const frame = useRef<number | null>(null);
  const clear = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    pending.current = null;
  };
  useEffect(() => clear, []);
  const queue = (position: { x: number; y: number }) => {
    pending.current = { x: position.x, y: position.y };
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const next = pending.current;
      pending.current = null;
      if (next) latest.current({ ...next, __transient: true });
    });
  };
  return { queue, clear };
}
