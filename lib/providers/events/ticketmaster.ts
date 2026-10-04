import type { Place } from '@/lib/timefit';
import { bearing, hav } from '../places/overpass';

export type EventsResult = { events: Place[]; status: 'ok' | 'not_configured' | 'error'; message?: string };

// Ticketmaster Discovery API: events starting in the next 8 hours. Not cached, since start times are time-sensitive.
export async function searchEvents(lat: number, lon: number, radius: number): Promise<EventsResult> {
  const key = process.env.TICKETMASTER_API_KEY;
  if (!key) return { events: [], status: 'not_configured', message: 'Live event data is not configured. Nearby places still work.' };
  const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${key}&latlong=${lat},${lon}&radius=${Math.ceil(radius)}&unit=km&startDateTime=${iso(new Date())}&endDateTime=${iso(new Date(Date.now() + 8 * 3600e3))}&size=50&sort=date,asc`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
    if (res.status === 401 || res.status === 403) return { events: [], status: 'error', message: 'The event provider rejected the API key.' };
    if (res.status === 429) return { events: [], status: 'error', message: 'Event provider rate limit reached. Try again shortly.' };
    if (!res.ok) return { events: [], status: 'error', message: 'Live event data is temporarily unavailable. Nearby places still work.' };
    const d = await res.json();
    const events: Place[] = (d._embedded?.events ?? []).flatMap((e: any): Place[] => {
      const v = e._embedded?.venues?.[0];
      const la = parseFloat(v?.location?.latitude), lo = parseFloat(v?.location?.longitude), at = Date.parse(e.dates?.start?.dateTime ?? '');
      if (![la, lo, at].every(Number.isFinite)) return [];
      const pr = e.priceRanges?.[0];
      return [{
        id: 'tm' + e.id, name: e.name, emoji: '🎟️', kind: (e.classifications?.[0]?.segment?.name ?? 'event').toLowerCase(),
        vibes: ['entertainment', 'social'], km: Math.round(hav(lat, lon, la, lo) * 10) / 10, bearing: Math.round(bearing(lat, lon, la, lo)),
        lat: la, lon: lo, dur: 120, cost: pr?.currency === 'INR' ? Math.round(pr.min) : 0, open: null, close: null, hours: null,
        startAt: at, url: e.url ?? null, source: 'ticketmaster',
      }];
    });
    return { events, status: 'ok' };
  } catch {
    return { events: [], status: 'error', message: 'Live event data is temporarily unavailable. Nearby places still work.' };
  }
}
