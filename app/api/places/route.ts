import { NextRequest, NextResponse } from 'next/server';
import type { Place } from '@/lib/timefit';
import { searchPlaces } from '@/lib/providers/places/overpass';
import { searchEvents } from '@/lib/providers/events/ticketmaster';
import { travelMinutes } from '@/lib/providers/directions/osrm';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat = parseFloat(sp.get('lat') ?? ''), lon = parseFloat(sp.get('lon') ?? '');
  const radius = Math.min(Math.max(parseFloat(sp.get('radius') ?? '5') || 5, 1), 15);
  if (!(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180)) return NextResponse.json({ error: 'Invalid location' }, { status: 400 });

  const [pl, ev] = await Promise.all([
    searchPlaces(lat, lon, radius).then((p) => ({ p, err: '' })).catch((e) => ({ p: [] as Place[], err: String(e.message) })),
    searchEvents(lat, lon, radius),
  ]);
  const notes: string[] = [];
  if (pl.err) notes.push(pl.err);
  if (ev.status !== 'ok' && ev.message) notes.push(ev.message);
  if (pl.err && ev.status !== 'ok' && !ev.events.length) return NextResponse.json({ error: notes.join(' ') }, { status: 502 });

  const all = [...pl.p, ...ev.events].sort((a, b) => a.km - b.km);
  const near = all.slice(0, 90);
  const times = await travelMinutes({ lat, lon }, near).catch(() => [] as (number | null)[]);
  near.forEach((p, i) => { if (times[i] != null) p.travelMin = times[i] as number; });
  if (near.length && !times.some((t) => t != null)) notes.push('The routing service did not respond, so travel times are estimates.');
  return NextResponse.json({ places: all, notes });
}
