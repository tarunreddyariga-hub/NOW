// Driving travel times from the public OSRM demo server (fair-use, driving profile only).
export async function travelMinutes(from: { lat: number; lon: number }, to: { lat: number; lon: number }[]): Promise<(number | null)[]> {
  if (!to.length) return [];
  const coords = [from, ...to].map((c) => `${c.lon},${c.lat}`).join(';');
  const res = await fetch(`https://router.project-osrm.org/table/v1/driving/${coords}?sources=0&annotations=duration`, {
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 300 },
  });
  if (!res.ok) return to.map(() => null);
  const row: (number | null)[] | undefined = (await res.json()).durations?.[0];
  if (!row) return to.map(() => null);
  return row.slice(1).map((s) => (s == null ? null : Math.max(1, Math.round(s / 60))));
}
