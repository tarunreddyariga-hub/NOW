export type Place = {
  id: string; name: string; emoji: string; kind: string; vibes: string[];
  km: number; bearing: number; lat: number; lon: number;
  dur: number; cost: number; open: number | null; close: number | null; hours: string | null;
  travelMin?: number;          // routed one-way minutes, when the routing provider answered
  startAt?: number | null;     // event start, epoch ms
  url?: string | null; source?: string;
};
export type Query = { avail: number; vibes: string[]; budget: number; radius: number };
export type Result = {
  p: Place; t: number; wait: number; total: number; left: number; score: number;
  status: 'fit' | 'almost'; unverified: boolean; soon: boolean; notes: string[];
  back: number; c: Record<string, number>;
};

// Configurable scoring weights (must sum to 1)
export const WEIGHTS: Record<string, number> = { fit: 0.35, dist: 0.2, budget: 0.15, vibe: 0.15, avail: 0.15 };
export const BUF = 10;     // minutes of slack kept at the end
export const ALMOST = 20;  // minutes over that still count as "almost fits"
export const NO_LIMIT = 5000;
export const EVENT_DURATION = 120; // providers do not give end times; assumed

// Fallback only: estimated one-way minutes when routing is unavailable
export const travel = (km: number) => Math.round(3 + km * 4);

export function evaluate(p: Place, q: Query, now: number, nowMs: number = Date.now()): Result | null {
  if (p.km > q.radius) return null;
  if (q.budget < NO_LIMIT && p.cost > q.budget) return null;
  if (q.vibes.length && !p.vibes.some((v) => q.vibes.includes(v))) return null;

  const notes: string[] = [];
  const t = p.travelMin ?? travel(p.km);
  if (p.travelMin == null) notes.push('Travel time is estimated, not routed.');
  let wait = 0, soon = false, availScore = 0.5, unverified = false;

  if (p.startAt != null) {
    const until = (p.startAt - nowMs) / 60000;
    if (until < t - 10) return null; // cannot arrive within 10 min of the start
    wait = Math.round(Math.max(0, until - t));
    soon = until <= 30;
    availScore = 1;
    notes.push('The provider gives no end time, so 2 hours is assumed.');
  } else if (p.open === null || p.close === null) {
    unverified = true;
    notes.push('Opening hours are not listed, so open status is unverified.');
  } else {
    let a = (now + t) % 1440;
    if (a < p.open && p.close > 1440) a += 1440;
    if (a < p.open || a + p.dur > p.close) return null;
    availScore = p.close - (a + p.dur) >= 60 ? 1 : 0.6;
  }

  const total = t + wait + p.dur + t + BUF;
  const left = q.avail - total;
  if (left < -ALMOST) return null;

  const c = {
    fit: left >= 0 ? 0.5 + (0.5 * total) / q.avail : 0.2,
    dist: 1 - p.km / q.radius,
    budget: q.budget >= NO_LIMIT || !p.cost ? 1 : 1 - (0.4 * p.cost) / q.budget,
    vibe: q.vibes.length ? 1 : 0.7,
    avail: availScore,
  };
  const score = Object.keys(c).reduce((s, k) => s + WEIGHTS[k] * c[k as keyof typeof c], 0);
  return { p, t, wait, total, left, score, status: left >= 0 ? 'fit' : 'almost', unverified, soon, notes, back: now + t + wait + p.dur + t, c };
}
