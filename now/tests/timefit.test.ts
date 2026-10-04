import { describe, expect, it } from 'vitest';
import { evaluate, NO_LIMIT, type Place, type Query } from '../lib/timefit';

const base: Place = { id: 'x', name: 'Cafe', emoji: '☕', kind: 'cafe', vibes: ['food'], km: 1, bearing: 0, lat: 0, lon: 0, dur: 60, cost: 200, open: 480, close: 1380, hours: null, travelMin: 10 };
const q: Query = { avail: 90, vibes: [], budget: NO_LIMIT, radius: 5 };
const noon = 720;

describe('time fit', () => {
  it('computes available - travel - activity - return - buffer', () => {
    const r = evaluate(base, q, noon)!;
    expect(r.total).toBe(90);
    expect(r.left).toBe(0);
    expect(r.status).toBe('fit');
  });
  it('marks overruns within 20 min as almost, and drops anything longer', () => {
    expect(evaluate(base, { ...q, avail: 80 }, noon)!.status).toBe('almost');
    expect(evaluate(base, { ...q, avail: 60 }, noon)).toBeNull();
  });
  it('filters by budget and distance', () => {
    expect(evaluate(base, { ...q, budget: 100 }, noon)).toBeNull();
    expect(evaluate({ ...base, km: 6 }, q, noon)).toBeNull();
  });
  it('excludes places that are closed on arrival', () => {
    expect(evaluate(base, q, 60)).toBeNull();
  });
  it('flags estimated travel and unknown hours instead of claiming a perfect fit', () => {
    const r = evaluate({ ...base, travelMin: undefined, open: null, close: null }, q, noon)!;
    expect(r.notes.length).toBe(2);
  });
  it('handles events: reachable, too soon, and waiting time', () => {
    const nowMs = 1_000_000_000_000;
    const ev = (mins: number): Place => ({ ...base, startAt: nowMs + mins * 60000, dur: 60 });
    expect(evaluate(ev(-1), q, noon, nowMs)).toBeNull();         // would arrive 11 min after the start
    expect(evaluate(ev(5), q, noon, nowMs)).not.toBeNull();      // arrives 5 min late, still joinable
    expect(evaluate(ev(25), q, noon, nowMs)!.wait).toBe(15);     // arrives early, waits
    expect(evaluate(ev(25), q, noon, nowMs)!.soon).toBe(true);
  });
});
