import type { Place } from '@/lib/timefit';

// OSM tag -> [emoji, vibes, typical minutes, typical cost in INR]. Durations and costs are category estimates.
const KINDS: Record<string, [string, string[], number, number]> = {
  'amenity=cafe': ['☕', ['chill', 'food'], 45, 250],
  'amenity=restaurant': ['🍽️', ['food', 'social'], 60, 500],
  'amenity=fast_food': ['🍔', ['food'], 25, 200],
  'amenity=ice_cream': ['🍨', ['food', 'chill'], 25, 150],
  'amenity=cinema': ['🎬', ['entertainment'], 150, 300],
  'amenity=theatre': ['🎭', ['entertainment', 'learn'], 120, 400],
  'amenity=arts_centre': ['🎨', ['explore', 'learn'], 60, 150],
  'amenity=library': ['📚', ['chill', 'learn'], 45, 0],
  'amenity=marketplace': ['🛍️', ['explore', 'food'], 45, 0],
  'shop=books': ['📖', ['chill', 'explore'], 30, 0],
  'leisure=park': ['🌳', ['chill', 'explore', 'active'], 40, 0],
  'leisure=sports_centre': ['🏟️', ['active', 'social'], 60, 250],
  'leisure=swimming_pool': ['🏊', ['active'], 60, 200],
  'leisure=fitness_centre': ['🏋️', ['active'], 60, 300],
  'leisure=pitch': ['⚽', ['active', 'social'], 60, 100],
  'leisure=amusement_arcade': ['🎮', ['entertainment', 'social'], 60, 400],
  'tourism=museum': ['🏛️', ['explore', 'learn'], 75, 100],
  'tourism=gallery': ['🖼️', ['explore', 'learn'], 40, 0],
  'tourism=viewpoint': ['🌇', ['explore', 'chill'], 20, 0],
  'tourism=attraction': ['📍', ['explore'], 45, 100],
};
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const rad = (d: number) => (d * Math.PI) / 180;

export function hav(a: number, b: number, c: number, d: number) {
  const x = Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
}
export function bearing(a: number, b: number, c: number, d: number) {
  const y = Math.sin(rad(d - b)) * Math.cos(rad(c));
  const x = Math.cos(rad(a)) * Math.sin(rad(c)) - Math.sin(rad(a)) * Math.cos(rad(c)) * Math.cos(rad(d - b));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
// Only simple opening_hours values are read; anything else is treated as unknown (never guessed).
function parseHours(h?: string): [number | null, number | null] {
  if (!h) return [null, null];
  if (h.trim() === '24/7') return [0, 1440];
  const m = h.trim().match(/^(?:Mo-Su\s+)?(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
  if (!m) return [null, null];
  const o = +m[1] * 60 + +m[2];
  let c = +m[3] * 60 + +m[4];
  if (c <= o) c += 1440;
  return [o, c];
}

export async function searchPlaces(lat: number, lon: number, radius: number): Promise<Place[]> {
  const around = `(around:${radius * 1000},${lat},${lon})`;
  const groups: Record<string, string[]> = {};
  Object.keys(KINDS).forEach((k) => { const [key, v] = k.split('='); (groups[key] ||= []).push(v); });
  const body = Object.entries(groups).map(([k, v]) => `nwr${around}["${k}"~"^(${v.join('|')})$"]["name"];`).join('');
  const query = `[out:json][timeout:20];(${body});out center tags 500;`;

  let data: any = null;
  for (const ep of ENDPOINTS) {
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'NOW-app/0.1' },
        body: 'data=' + encodeURIComponent(query),
        signal: AbortSignal.timeout(18000),
        next: { revalidate: 300 },
      });
      if (res.ok) { data = await res.json(); break; }
    } catch { /* try next endpoint */ }
  }
  if (!data) throw new Error('The places service did not respond. Try again in a moment.');

  const byKind: Record<string, Place[]> = {};
  for (const el of data.elements ?? []) {
    const tags = el.tags ?? {};
    const kind = Object.keys(KINDS).find((k) => { const [a, b] = k.split('='); return tags[a] === b; });
    const la = el.lat ?? el.center?.lat, lo = el.lon ?? el.center?.lon;
    if (!kind || la == null || lo == null) continue;
    const [emoji, vibes, dur, cost] = KINDS[kind];
    const [open, close] = parseHours(tags.opening_hours);
    (byKind[kind] ||= []).push({
      id: `${el.type[0]}${el.id}`, name: tags.name, emoji, kind: kind.split('=')[1].replace('_', ' '), vibes,
      km: Math.round(hav(lat, lon, la, lo) * 10) / 10, bearing: Math.round(bearing(lat, lon, la, lo)),
      lat: la, lon: lo, dur, cost, open, close, hours: tags.opening_hours ?? null,
      url: tags.website ?? tags['contact:website'] ?? null, source: 'osm',
    });
  }
  // keep results diverse: nearest 10 per kind
  const places = Object.values(byKind).flatMap((l) => l.sort((a, b) => a.km - b.km).slice(0, 10));
  return places;
}
