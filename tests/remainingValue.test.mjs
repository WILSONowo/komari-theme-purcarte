import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateValue, parseRates, DAY } from '../src/utils/remainingValue.ts';

const now = Date.parse('2026-09-27T00:00:00Z');
const node = (overrides = {}) => ({price: 300, billing_cycle: 30, currency: '¥', expired_at: new Date(now + 15 * DAY).toISOString(), ...overrides});
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('remaining value uses whole days rounded up within the billing cycle', () => {
  close(calculateValue([node()], {}, now).total.remaining, 150);
  close(calculateValue([node({expired_at: new Date(now + 2.25 * DAY).toISOString()})], {}, now).total.remaining, 30);
});
test('uses actual 92 and 184 day billing periods', () => {
  close(calculateValue([node({price:92, billing_cycle:92}), node({price:184,billing_cycle:184})], {}, now).total.remaining, 30);
});
test('converts CNY, dollars and euros exactly once', () => {
  close(calculateValue([node(),node({currency:'$'}),node({currency:'€'})], {USD:7,EUR:8}, now).total.remaining, 2400);
});
test('base CNY provider rates are inverted to CNY per currency unit', () => {
  const rates = parseRates({base:'CNY',date:'2026-09-25',rates:{USD:0.125,EUR:0.1,GBP:0.08,JPY:20}}).rates;
  close(rates.USD,8); close(rates.EUR,10); close(rates.JPY,0.05);
});
test('missing FX marks the sum incomplete rather than a complete CNY total', () => {
  const value = calculateValue([node(),node({currency:'$'})], {}, now);
  assert.equal(value.missingRates,1); assert.equal(value.converted,1); assert.equal(value.included,2);
  close(value.byCurrency.USD.remaining,150);
});
test('expired value is zero; remaining value is capped at one billing period', () => {
  close(calculateValue([node({expired_at:new Date(now-DAY).toISOString()})],{},now).total.remaining,0);
  close(calculateValue([node({expired_at:new Date(now+60*DAY).toISOString()})],{},now).total.remaining,300);
});
test('equivalent timezone offsets produce the same remaining value', () => {
  close(calculateValue([node({expired_at:'2026-09-28T08:00:00+08:00'})],{},now).total.remaining,10);
  close(calculateValue([node({expired_at:'2026-09-28T00:00:00Z'})],{},now).total.remaining,10);
});
test('free and unknown prices are excluded; valid one-time purchase retains its price', () => {
  const value = calculateValue([node({price:0}), node({price:-1}), node({billing_cycle:-1}),node({expired_at:null}),node({price:NaN})],{},now);
  assert.equal(value.free,1); assert.equal(value.excluded,3); close(value.total.remaining,300);
});
test('invalid or zero rates are rejected', () => {
  assert.throws(() => parseRates({base:'CNY',date:'2026-09-25',rates:{USD:0,EUR:1,GBP:1,JPY:1}}));
  assert.equal(calculateValue([node({currency:'USD'})],{USD:Infinity},now).missingRates,1);
});

test('Glass long-term and one-time rules respect expiry and missing expiry', () => {
  close(calculateValue([node({expired_at:new Date(now+40000*DAY).toISOString()})],{},now).total.remaining,300);
  close(calculateValue([node({billing_cycle:-1,expired_at:new Date(now-DAY).toISOString()})],{},now).total.remaining,0);
  assert.equal(calculateValue([node({billing_cycle:-1,expired_at:null})],{},now).excluded,1);
});

test('current value sums cycle prices rather than remaining or annual cost', () => {
  const value = calculateValue([node(), node({currency:'USD'}), node({expired_at:null})],{USD:7},now);
  close(value.currentValue,2700);
  close(value.total.remaining,1200);
  assert.equal(value.currentCount,3);
});
test('current value with missing FX remains incomplete even without an expiry', () => {
  const value = calculateValue([node(),node({currency:'USD',expired_at:null})],{},now);
  assert.equal(value.currentMissingRates,1);
  close(value.currentValue,300);
});
