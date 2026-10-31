import { useEffect, useMemo, useRef, useState } from "react";
import { Popover } from "@radix-ui/themes";
import { useLocale } from "@/config/hooks";
import { useValueRates } from "@/hooks/useValueRates";
import { calculateValue, type BillingNode } from "@/utils/remainingValue";
import { StatChip } from "./StatChips";

const money = (amount: number) => amount.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function RemainingValueChip({ nodes, loading, isMobile, isInHeader = false }: {
  nodes: BillingNode[]; loading: boolean; isMobile: boolean; isInHeader?: boolean;
}) {
  const { t } = useLocale();
  const { snapshot, failed } = useValueRates();
  const [now, setNow] = useState(Date.now);
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearClose = () => { if (closeTimer.current) clearTimeout(closeTimer.current); };
  const hoverOpen = () => { clearClose(); setOpen(true); };
  const hoverClose = () => { clearClose(); closeTimer.current = setTimeout(() => setOpen(false), 180); };
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => { clearInterval(timer); if (closeTimer.current) clearTimeout(closeTimer.current); };
  }, []);
  const value = useMemo(() => calculateValue(nodes, snapshot?.rates || { CNY: 1 }, now), [nodes, snapshot, now]);
  const hasValue = value.missingRates === 0 && (value.converted > 0 || value.free > 0);
  const lines = loading ? ["..."] : value.missingRates > 0 ? [failed || snapshot ? "汇率不可用" : "汇率获取中…"] : !hasValue ? ["暂无数据"] : [
    `¥ ${money(value.total.remaining)}`,
  ];
  return <Popover.Root open={open} onOpenChange={setOpen}>
    <Popover.Trigger>
      <button type="button" aria-label="查看价值明细"
        className="min-w-0 justify-self-center text-primary cursor-default border-0 bg-transparent p-0 outline-none no-underline hover:no-underline focus:no-underline tabular-nums"
        onPointerEnter={event => { if (event.pointerType === "mouse") hoverOpen(); }}
        onPointerLeave={event => { if (event.pointerType === "mouse") hoverClose(); }}>
        <StatChip label={t("statsBar.remainingValue")} lines={lines} isMobile={isMobile} isInHeader={isInHeader} />
      </button>
    </Popover.Trigger>
    <Popover.Content side="bottom" align="center" sideOffset={8} collisionPadding={16}
      className="purcarte-blur theme-card-style"
      style={{ width: "min(380px, calc(100vw - 32px))", maxHeight: "min(520px, 75dvh)", overflowY: "auto", backgroundColor: "var(--card)", zIndex: 80 }}
      onOpenAutoFocus={event => event.preventDefault()}
      onPointerEnter={clearClose}
      onPointerLeave={event => { if (event.pointerType === "mouse") hoverClose(); }}>
      <div className="grid grid-cols-3 gap-3 text-center tabular-nums">
        {[
          ["每年支出", value.total.annual],
          ["每月支出", value.total.monthly],
          ["剩余价值", value.total.remaining],
        ].map(([label, amount]) => (
          <div key={label} className="min-w-0">
            <div className="text-xs opacity-65">{label}</div>
            <div className="mt-1 text-sm font-semibold text-primary break-words">
              {hasValue ? `¥ ${money(Number(amount))}` : "—"}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 border-t border-(--accent-a4) pt-3 text-xs">
        <div className="flex justify-between gap-2 opacity-65">
          <span>参考汇率</span>
          <span>{snapshot ? `${snapshot.date} · CNY` : failed ? "暂不可用" : "获取中…"}</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-5 gap-y-1.5 tabular-nums">
          {["USD", "EUR", "GBP", "JPY"].map(code => (
            <div key={code} className="flex justify-between gap-2">
              <span className="opacity-65">{code}</span>
              <span>{snapshot?.rates[code] ? `¥ ${snapshot.rates[code].toFixed(4)}` : "—"}</span>
            </div>
          ))}
        </div>
        {(value.excluded > 0 || (failed && snapshot)) && (
          <p className="mt-2 text-[11px] opacity-55">
            {value.excluded > 0 ? "按已知数据估算" : ""}
            {value.excluded > 0 && failed && snapshot ? " · " : ""}
            {failed && snapshot ? "使用缓存汇率" : ""}
          </p>
        )}
      </div>
    </Popover.Content>
  </Popover.Root>;
}
