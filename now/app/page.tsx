'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { User } from '@supabase/supabase-js';
import Account from '@/components/Account';
import { supabase } from '@/lib/supabase';
import { evaluate, WEIGHTS, BUF, NO_LIMIT, type Place, type Result } from '@/lib/timefit';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false, loading: () => <p className="mut">Loading map...</p> });
const VIBES = ['chill', 'social', 'active', 'explore', 'food', 'entertainment', 'learn'];
const LABEL: Record<string, string> = { fit: 'Time fit', dist: 'Distance', budget: 'Budget fit', vibe: 'Vibe match', avail: 'Availability' };
const dur = (m: number) => {
  m = Math.round(m); const h = Math.floor(m / 60), r = m % 60;
  return h ? (r ? `${h}h ${r}m` : `${h}h`) : `${r}m`;
};
const fmt = (m: number) => {
  m = ((Math.round(m) % 1440) + 1440) % 1440; const h = Math.floor(m / 60);
  return `${h % 12 || 12}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const mapsUrl = (p: Place) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`;

export default function Home() {
  const [q, setQ] = useState({ avail: 90, vibes: [] as string[], budget: NO_LIMIT, radius: 5 });
  const [loc, setLoc] = useState<{ lat: number; lon: number; label: string } | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [err, setErr] = useState('');
  const [now, setNow] = useState<number | null>(null);
  const [day, setDay] = useState('');
  const [city, setCity] = useState('');
  const [msg, setMsg] = useState('');
  const [pick, setPick] = useState<Result | 'none' | null>(null);
  const [retry, setRetry] = useState(0);
  const [notes, setNotes] = useState<string[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [saved, setSaved] = useState<Record<string, Place>>({});

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow(d.getHours() * 60 + d.getMinutes());
      setDay(d.toLocaleDateString(undefined, { weekday: 'long' }));
    };
    tick();
    const i = setInterval(tick, 10000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    if (!loc) return;
    const ac = new AbortController();
    setState('loading');
    const t = setTimeout(() => {
      fetch(`/api/places?lat=${loc.lat}&lon=${loc.lon}&radius=${q.radius}`, { signal: ac.signal })
        .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Request failed'); return d; })
        .then((d) => { setPlaces(d.places); setNotes(d.notes ?? []); setState('ok'); })
        .catch((e) => { if (e?.name !== 'AbortError') { setErr(e.message); setState('error'); } });
    }, 250);
    return () => { clearTimeout(t); ac.abort(); };
  }, [loc, q.radius, retry]);

  useEffect(() => {
    if (!supabase || !user) { setSaved({}); return; }
    supabase.from('saved_activities').select('provider_id,data').then(({ data }) =>
      setSaved(Object.fromEntries((data ?? []).map((r: any) => [r.provider_id, r.data]))));
  }, [user]);
  const toggleSave = async (p: Place) => {
    if (!supabase || !user) { setMsg('Sign in to save activities.'); document.getElementById('account')?.scrollIntoView({ behavior: 'smooth' }); return; }
    if (saved[p.id]) {
      const { error } = await supabase.from('saved_activities').delete().eq('user_id', user.id).eq('provider_id', p.id);
      if (error) return setMsg(error.message);
      setSaved((s) => { const n = { ...s }; delete n[p.id]; return n; });
    } else {
      const { error } = await supabase.from('saved_activities').insert({ user_id: user.id, provider: p.source ?? 'osm', provider_id: p.id, name: p.name, data: p });
      if (error) return setMsg(error.message);
      setSaved((s) => ({ ...s, [p.id]: p }));
    }
  };
  const focusCard = useCallback((id: string) => {
    const el = document.getElementById('c' + id);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.classList.add('flash'); setTimeout(() => el?.classList.remove('flash'), 1500);
  }, []);
  const rs = useMemo(
    () => (now === null ? [] : (places.map((p) => evaluate(p, q, now)).filter(Boolean) as Result[]).sort((a, b) => b.score - a.score)),
    [places, q, now],
  );
  const perfect = rs.filter((r) => r.status === 'fit' && !r.notes.length).slice(0, 12);
  const est = rs.filter((r) => r.status === 'fit' && r.notes.length).slice(0, 12);
  const fit = [...perfect, ...est];
  const almost = rs.filter((r) => r.status === 'almost').slice(0, 6);
  const set = (patch: Partial<typeof q>) => { setQ({ ...q, ...patch }); setPick(null); };

  const locate = () => {
    setMsg('');
    if (!navigator.geolocation) return setMsg('This browser cannot share location. Search for a city instead.');
    navigator.geolocation.getCurrentPosition(
      (p) => setLoc({ lat: p.coords.latitude, lon: p.coords.longitude, label: 'Your location' }),
      () => setMsg('Location was not shared. Search for a city instead.'),
      { timeout: 10000 },
    );
  };
  const search = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg('');
    const r = await fetch('/api/geocode?q=' + encodeURIComponent(city));
    const d = await r.json();
    if (r.ok) setLoc(d); else setMsg(d.error || 'Search failed');
  };
  const surprise = () => {
    const pool = fit.filter((r) => !(pick && pick !== 'none' && pick.p.id === r.p.id)).slice(0, 5);
    if (!pool.length) return setPick('none');
    let n = Math.random() * pool.reduce((s, r) => s + r.score, 0), r = pool[0];
    for (const x of pool) { n -= x.score; if (n <= 0) { r = x; break; } }
    setPick(r);
  };

  const Card = ({ r }: { r: Result }) => {
    const p = r.p, base = Math.max(q.avail, r.total);
    const parts: [string, number, string][] = [['t1', r.t, 'Travel there'], ['t2', p.dur, 'Activity'], ['t3', r.t, 'Travel back'], ['t5', BUF, 'Buffer']];
    return (
      <article className="card" id={'c' + p.id}>
        <div className="row">
          <span className="em" aria-hidden="true">{p.emoji}</span>
          <div><h3>{p.name}</h3><div className="mut">{p.kind}, {p.km} km, {r.t} min {p.travelMin != null ? 'by road' : '(estimated)'}, {p.startAt ? `starts ${fmt((now ?? 0) + (p.startAt - Date.now()) / 60000)}` : p.hours ?? 'hours not listed'}</div></div>
          <div className="price">{p.cost ? `about ₹${p.cost}` : p.source === 'ticketmaster' ? 'Price: see provider' : 'Free'}</div>
        </div>
        <div className="bar" role="img" aria-label="Time breakdown">
          {parts.map(([c, v], i) => <i key={i} className={c} style={{ width: `${(v / base) * 100}%` }} />)}
        </div>
        <div className={r.status === 'fit' ? 'ok' : 'no'}>
          {r.status === 'fit' ? `${r.notes.length ? 'Estimated fit' : 'Perfect fit'}: ${dur(r.left)} to spare of your ${dur(q.avail)}.${r.soon ? ' Starting soon.' : ''} ${r.notes.join(' ')}` : `Almost: ${dur(-r.left)} over your ${dur(q.avail)}`}
        </div>
        <details>
          <summary>Time breakdown and why this</summary>
          <ul>
            {parts.map(([, v, l], i) => <li key={i}><span>{l}</span><b>{v} min</b></li>)}
            <li><span>Total</span><b>{dur(r.total)}</b></li>
            <li><span>Back by</span><b>{fmt(r.back + BUF)}</b></li>
          </ul>
          <ul>
            {Object.keys(LABEL).map((k) => <li key={k}><span>{LABEL[k]}</span><b>{Math.round(WEIGHTS[k] * r.c[k] * 100)} / {WEIGHTS[k] * 100}</b></li>)}
            <li><span>Score</span><b>{Math.round(r.score * 100)}</b></li>
          </ul>
          <p className="mut">Duration and cost are typical for this kind of place, not live data. Booking is not available through NOW.</p>
        </details>
        <div className="loc" style={{ marginTop: 10 }}>
          <a className="btn ghost" href={mapsUrl(p)} target="_blank" rel="noopener noreferrer">Get directions</a>
          {p.url && <a className="btn ghost" href={p.url} target="_blank" rel="noopener noreferrer">{p.source === 'ticketmaster' ? 'View on Ticketmaster' : 'View venue website'}</a>}
          <button className="btn ghost" onClick={() => toggleSave(p)}>{saved[p.id] ? 'Saved, tap to remove' : 'Save'}</button>
        </div>
      </article>
    );
  };

  return (
    <main>
      <div className="top">
        <div><h1>NOW</h1><p className="tag">You have time. Do something with it.</p></div>
        <div className="clock"><span>{day}</span><b>{now === null ? '' : fmt(now)}</b></div>
      </div>

      <h2>How much time do you have?</h2>
      <div className="big" aria-live="polite">{dur(q.avail)}</div>
      <p className="sub">{now === null ? '' : `Free until ${fmt(now + q.avail)}`}</p>
      <input type="range" min={15} max={300} step={5} value={q.avail} aria-label="Free time in minutes" onChange={(e) => set({ avail: +e.target.value })} />
      <div className="chips">
        {[[30, '30 min'], [60, '1 hour'], [120, '2 hours'], [180, '3 hours'], [240, '4+ hours']].map(([v, l]) => (
          <button key={v} className="chip" aria-pressed={q.avail === v} onClick={() => set({ avail: v as number })}>{l}</button>
        ))}
      </div>

      <h2>What is your vibe?</h2>
      <div className="chips">
        {VIBES.map((v) => (
          <button key={v} className="chip" aria-pressed={q.vibes.includes(v)} onClick={() => set({ vibes: q.vibes.includes(v) ? q.vibes.filter((x) => x !== v) : [...q.vibes, v] })}>
            {v[0].toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      <h2>Budget: {q.budget >= NO_LIMIT ? 'no limit' : `up to ₹${q.budget.toLocaleString('en-IN')}`}</h2>
      <input type="range" min={0} max={NO_LIMIT} step={100} value={q.budget} aria-label="Budget in rupees" onChange={(e) => set({ budget: +e.target.value })} />

      <h2>How far will you go?</h2>
      <div className="chips">
        {[[1, '1 km'], [3, '3 km'], [5, '5 km'], [10, '10 km'], [15, 'Anywhere nearby']].map(([v, l]) => (
          <button key={v} className="chip" aria-pressed={q.radius === v} onClick={() => set({ radius: v as number })}>{l}</button>
        ))}
      </div>

      <h2>Where are you? Now using: {loc ? loc.label : 'not set yet'}</h2>
      <p className="sub">Sharing location lets NOW find places you can actually reach. It is optional.</p>
      <div className="loc">
        <button className="btn ghost" onClick={locate}>Use my location</button>
        <form onSubmit={search} className="loc" style={{ flex: 1 }}>
          <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Or search a city or area" aria-label="Search a city or area" />
          <button className="btn ghost" type="submit">Search</button>
        </form>
      </div>
      {msg && <p className="msg" role="alert">{msg}</p>}

      <h2 id="account">Account (optional)</h2>
      <Account onUser={setUser} />
      {user && Object.keys(saved).length > 0 && (<><h2>Saved activities</h2>{Object.values(saved).map((p) => (
        <div key={p.id} className="row" style={{ marginBottom: 8 }}><span aria-hidden="true">{p.emoji}</span><div><b>{p.name}</b><div className="mut">{p.kind}</div></div>
          <a className="btn ghost" href={mapsUrl(p)} target="_blank" rel="noopener noreferrer">Directions</a>
          <button className="btn ghost" onClick={() => toggleSave(p)}>Remove</button></div>))}</>)}
      <div className="cta"><button className="btn" onClick={surprise}>Surprise me</button></div>

      <div className="grid">
        <div aria-live="polite">
          {pick && pick !== 'none' && (
            <div className="pick">
              <div className="mut">We found something for you</div>
              <div className="e" aria-hidden="true">{pick.p.emoji}</div>
              <h3>{pick.p.name}</h3>
              <p>You have {dur(q.avail)}. This is about {pick.t} minutes away, {pick.p.km} km. You can be back by {fmt(pick.back + BUF)}.</p>
              <div className="cta" style={{ justifyContent: 'center', marginTop: 8 }}>
                <a className="btn" href={mapsUrl(pick.p)} target="_blank" rel="noopener noreferrer">Get directions</a>
                <button className="btn ghost" onClick={surprise}>Try another</button>
              </div>
            </div>
          )}
          {pick === 'none' && <p className="msg">Nothing fits your {dur(q.avail)} to pick from. Try more time or a wider radius.</p>}

          {notes.map((n) => <p key={n} className="msg" role="status">{n}</p>)}
          {state === 'idle' && <div className="empty"><h2>Where are you?</h2><p className="mut">Share your location or search a city to see what fits your time.</p></div>}
          {state === 'loading' && <><p className="mut">Checking what is open around {loc?.label}...</p>{[0, 1, 2].map((i) => <div key={i} className="skel" />)}</>}
          {state === 'error' && (
            <div className="empty"><h2>Could not load places.</h2><p className="mut">{err}</p>
              <button className="btn" onClick={() => setRetry(retry + 1)}>Try again</button></div>
          )}
          {state === 'ok' && !rs.length && (
            <div className="empty">
              <h2>Nothing fits your {dur(q.avail)}.</h2>
              <div className="chips">
                <button className="chip" onClick={() => set({ avail: q.avail + 30 })}>Add 30 minutes</button>
                <button className="chip" onClick={() => set({ radius: 15 })}>Expand radius</button>
                <button className="chip" onClick={() => set({ budget: NO_LIMIT, vibes: [] })}>Remove budget and vibe limits</button>
              </div>
            </div>
          )}
          {state === 'ok' && perfect.length > 0 && <><div className="sec">Perfect fits</div>{perfect.map((r) => <Card key={r.p.id} r={r} />)}</>}
          {state === 'ok' && est.length > 0 && <><div className="sec">Estimated fits</div>{est.map((r) => <Card key={r.p.id} r={r} />)}</>}
          {state === 'ok' && almost.length > 0 && <><div className="sec w">Almost fits</div>{almost.map((r) => <Card key={r.p.id} r={r} />)}</>}
        </div>

        <div className="side">
          <h2 style={{ marginTop: 0 }}>Map</h2>
          {loc ? <MapView center={[loc.lat, loc.lon]} radius={q.radius} results={rs} onSelect={focusCard} /> : <p className="mut">The map appears once you set a location.</p>}
        </div>
      </div>

      <p className="foot">
        Places come from OpenStreetMap contributors, events from Ticketmaster when configured, and driving times from the OSRM routing demo server. If routing fails, travel is estimated (3 min plus 4 min per km). A {BUF} min buffer is added. Durations and costs are typical for each kind of place. NOW does not know live availability or bookings.
      </p>
    </main>
  );
}
