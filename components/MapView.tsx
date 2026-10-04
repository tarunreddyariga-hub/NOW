'use client';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Result } from '@/lib/timefit';

type Props = { center: [number, number]; radius: number; results: Result[]; onSelect: (id: string) => void };

// Real interactive map: OpenStreetMap tiles, pan and zoom, user position, one marker per result.
export default function MapView({ center, radius, results, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    const m = L.map(el.current!).setView(center, 13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => { m.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current, g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const ring = L.circle(center, { radius: radius * 1000, color: '#ffb020', weight: 1, fillOpacity: 0.04 }).addTo(g);
    L.circleMarker(center, { radius: 8, color: '#fff', weight: 2, fillColor: '#3b82f6', fillOpacity: 1 }).bindTooltip('You are here').addTo(g);
    results.forEach((r) =>
      L.circleMarker([r.p.lat, r.p.lon], { radius: 9, color: '#111', weight: 1, fillColor: r.status === 'fit' ? '#ffb020' : '#ff7a59', fillOpacity: 0.95 })
        .bindTooltip(r.p.name).on('click', () => onSelect(r.p.id)).addTo(g),
    );
    m.fitBounds(ring.getBounds(), { padding: [12, 12] });
  }, [center[0], center[1], radius, results, onSelect]);

  return <div ref={el} role="application" aria-label="Map of results around you" style={{ height: 400, borderRadius: 18, border: '1px solid var(--line)' }} />;
}
