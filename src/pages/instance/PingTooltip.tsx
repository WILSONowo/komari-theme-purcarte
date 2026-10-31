import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { CustomTooltip } from "@/components/ui/tooltip";

interface PingTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: any;
  coordinate?: { x?: number; y?: number };
  labelFormatter?: (label: any) => string;
  chartHostRef: RefObject<HTMLDivElement | null>;
}

export function PingTooltip({ chartHostRef, coordinate, ...props }: PingTooltipProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0, ready: false });
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => setDismissed(false), [coordinate?.x, coordinate?.y, props.active]);
  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDismissed(true);
    };
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, []);
  const shown = !!(props.active && props.payload?.length);

  useLayoutEffect(() => {
    if (!shown) {
      setPosition((previous) => ({ ...previous, ready: false }));
      return;
    }
    const updatePosition = () => {
      const chart = chartHostRef.current?.querySelector(".recharts-wrapper");
      const content = contentRef.current;
      if (!chart || !content) return;
      const bounds = chart.getBoundingClientRect();
      const { width, height } = content.getBoundingClientRect();
      const pointerX = bounds.left + (coordinate?.x ?? 0);
      const nextX = pointerX + 10 + width <= window.innerWidth
        ? pointerX + 10 : pointerX - width - 10;
      // Anchor vertically to the chart, independently of pointer movement.
      const nextY = bounds.bottom - height;
      const x = Math.max(0, Math.min(nextX, window.innerWidth - width));
      const y = Math.max(0, Math.min(nextY, window.innerHeight - height));
      setPosition((previous) => previous.ready && previous.x === x && previous.y === y
        ? previous : { x, y, ready: true });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [shown, dismissed, coordinate?.x, coordinate?.y, props.payload, chartHostRef]);

  if (!shown || dismissed) return null;

  // Stay under the theme for colors, but outside every page/chart scroll container.
  // The fixed clipped layer prevents even an oversized tooltip from adding overflow.
  const portalTarget = chartHostRef.current?.closest(".radix-themes") ?? document.body;
  return createPortal(
    <div data-ping-tooltip-layer="" style={{
      position: "fixed", inset: 0, overflow: "clip", pointerEvents: "none", zIndex: 100,
    }}>
      <div ref={contentRef} style={{
        position: "absolute", top: position.y, left: 0, width: "max-content",
        maxWidth: "100vw", visibility: position.ready ? "visible" : "hidden",
        transform: `translateX(${position.x}px)`,
        transition: position.ready ? "transform 400ms" : undefined,
      }}>
        <CustomTooltip {...props} />
      </div>
    </div>,
    portalTarget,
  );
}
