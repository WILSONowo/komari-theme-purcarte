import { useEffect, useState } from "react";
import { useAppConfig } from "@/config";
import { DAY, parseRates, type RateSnapshot } from "@/utils/remainingValue";
const KEY = "purcarte-value-rates-v1";
let pending: Promise<RateSnapshot> | null = null;
let memory: RateSnapshot | null = null;
function validCache(value: RateSnapshot) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value.date) && Number.isFinite(Date.parse(value.date)) && Number.isFinite(value.fetchedAt) && value.fetchedAt <= Date.now() &&
    ["CNY", "USD", "EUR", "GBP", "JPY"].every(code => Number.isFinite(value.rates?.[code]) && value.rates[code] > 0) && value.rates.CNY === 1;
}
export function useValueRates() {
  const { enableLocalStorage } = useAppConfig();
  const [snapshot, setSnapshot] = useState<RateSnapshot | null>(() => {
    if (memory) return memory;
    if (enableLocalStorage) try {
      const cached = JSON.parse(localStorage.getItem(KEY) || "null");
      if (validCache(cached)) return memory = cached;
    } catch { /* storage can be unavailable */ }
    return null;
  });
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (memory && Date.now() - memory.fetchedAt < DAY) { if (active) setSnapshot(memory); return; }
      try {
        pending ||= fetch("https://api.frankfurter.dev/v1/latest?base=CNY&symbols=USD,EUR,GBP,JPY", {
          credentials: "omit", referrerPolicy: "no-referrer", signal: AbortSignal.timeout(8000),
        }).then(response => {
          if (!response.ok) throw new Error("汇率获取失败");
          return response.json();
        }).then(data => memory = parseRates(data)).finally(() => { pending = null; });
        const value = await pending;
        if (enableLocalStorage) try { localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* optional cache */ }
        if (active) { setSnapshot(value); setFailed(false); }
      } catch { if (active) setFailed(true); }
    };
    void refresh();
    const timer = setInterval(refresh, 60 * 60 * 1000);
    return () => { active = false; clearInterval(timer); };
  }, [enableLocalStorage]);
  return { snapshot, failed };
}
