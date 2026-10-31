export interface BillingNode {
  price: number;
  billing_cycle: number;
  currency: string;
  expired_at: string | null;
}
export interface ValueTotal { remaining: number; monthly: number; annual: number }
export type Rates = Record<string, number>;
export const DAY = 86400000;
export function currencyCode(value: string): string {
  const code = (value || "").trim().toUpperCase();
  return ({ "¥": "CNY", "￥": "CNY", RMB: "CNY", "$": "USD", "US$": "USD", "€": "EUR", "£": "GBP" } as RatesAlias)[code] || code;
}
type RatesAlias = Record<string, string>;
export function calculateValue(nodes: BillingNode[], rates: Rates, now = Date.now()) {
  const byCurrency: Record<string, ValueTotal> = {};
  const reasons: Record<string, number> = {};
  let included = 0, converted = 0, free = 0, missingRates = 0;
  let currentValue = 0, currentCount = 0, currentMissingRates = 0;
  const total: ValueTotal = { remaining: 0, monthly: 0, annual: 0 };
  const skip = (reason: string) => { reasons[reason] = (reasons[reason] || 0) + 1; };
  for (const node of nodes) {
    if (node.price === -1) { free++; continue; }
    if (!Number.isFinite(node.price) || node.price <= 0) { skip("价格未设置"); continue; }
    // Current value is the recorded price of one cycle, before time proration.
    // It does not require a known expiry date.
    const currentCurrency = currencyCode(node.currency);
    const currentRate = currentCurrency === "CNY" ? 1 : rates[currentCurrency];
    if (Number.isFinite(currentRate) && currentRate > 0 && Number.isFinite(node.price * currentRate)) {
      currentValue += node.price * currentRate;
      currentCount++;
    } else {
      currentMissingRates++;
    }
    if (!Number.isFinite(node.billing_cycle)) { skip("付款周期无效"); continue; }
    const expires = node.expired_at ? Date.parse(node.expired_at) : NaN;
    if (!Number.isFinite(expires)) { skip("到期时间未设置"); continue; }
    // Match Komari-Glass: charge by whole remaining days within one cycle.
    const days = Math.max(0, Math.ceil((expires - now) / DAY));
    const currency = currencyCode(node.currency);
    if (!currency) { skip("币种未设置"); continue; }
    const daily = node.billing_cycle > 0 ? node.price / node.billing_cycle : 0;
    const remaining = days === 0 ? 0 : days > 36500 || node.billing_cycle <= 0
      ? node.price : node.price * Math.min(days / node.billing_cycle, 1);
    const value = { remaining, monthly: daily * 365 / 12, annual: daily * 365 };
    if (!Object.values(value).every(Number.isFinite)) { skip("计费数据异常"); continue; }
    included++;
    const bucket = byCurrency[currency] ||= { remaining: 0, monthly: 0, annual: 0 };
    for (const key of ["remaining", "monthly", "annual"] as const) bucket[key] += value[key];
    const rate = currency === "CNY" ? 1 : rates[currency];
    if (!Number.isFinite(rate) || rate <= 0) { missingRates++; skip("汇率暂不可用"); continue; }
    converted++;
    for (const key of ["remaining", "monthly", "annual"] as const) total[key] += value[key] * rate;
  }
  return { total, currentValue, currentCount, currentMissingRates, byCurrency, included, converted, free, missingRates, reasons, excluded: Object.values(reasons).reduce((a,b) => a+b, 0) };
}

export interface RateSnapshot { date: string; fetchedAt: number; rates: Rates }
export function parseRates(data: unknown, fetchedAt = Date.now()): RateSnapshot {
  const value = data as { base?: string; date?: string; rates?: Rates };
  if (!value || value.base !== "CNY" || !/^\d{4}-\d{2}-\d{2}$/.test(value.date || "") || !Number.isFinite(Date.parse(value.date!)) || !value.rates) throw new Error("汇率数据无效");
  const rates: Rates = { CNY: 1 };
  for (const code of ["USD", "EUR", "GBP", "JPY"]) {
    const rate = value.rates[code];
    if (!Number.isFinite(rate) || rate <= 0) throw new Error("汇率数据不完整");
    rates[code] = 1 / rate;
  }
  return { date: value.date!, fetchedAt, rates };
}
