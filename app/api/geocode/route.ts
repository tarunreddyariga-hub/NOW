import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ error: 'Enter a city or area' }, { status: 400 });
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, {
      headers: { 'User-Agent': 'NOW-app/0.1' },
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 86400 },
    });
    const [hit] = res.ok ? await res.json() : [];
    if (!hit) return NextResponse.json({ error: 'No match found' }, { status: 404 });
    return NextResponse.json({ lat: +hit.lat, lon: +hit.lon, label: String(hit.display_name).split(',').slice(0, 2).join(',') });
  } catch {
    return NextResponse.json({ error: 'Search is unavailable right now' }, { status: 502 });
  }
}
