# NOW

You have time. Do something with it.

Tell NOW how much time you have. It finds real places nearby from OpenStreetMap and checks whether
travel there, the activity, travel back and a 10 minute buffer fit inside that time.

## Run locally

    npm install
    npm run dev      # http://localhost:3000

No API keys needed. Places come from the public Overpass API, city search from Nominatim.

## Deploy

Push to GitHub, import the repo in Vercel, deploy. No environment variables required.

## How it works

- `lib/timefit.ts`: time-fit and scoring engine (weights in `WEIGHTS`).
- `app/api/places`: nearby places from OpenStreetMap, with simple opening-hours parsing.
- `app/api/geocode`: city search.
- `app/page.tsx`: the interface. Slider changes re-score instantly in the browser.

## Data sources and freshness

- Places: OpenStreetMap via Overpass, cached 5 min. Hours are used only when listed in a simple form.
- Travel time: OSRM public demo server (driving only, fair use), cached 5 min; falls back to a labelled estimate.
- Events: Ticketmaster Discovery API, never cached; needs `TICKETMASTER_API_KEY`. Coverage varies by country.
- Map tiles: tile.openstreetmap.org. Use a tile provider before heavy traffic.
- No availability or booking is claimed; links go to the provider or venue.

## Accounts

Create a Supabase project, run `supabase/migrations/0001_init.sql` in the SQL editor, put the URL and anon key in `.env.local` (see `.env.example`). Enable Google under Authentication > Providers, then set `NEXT_PUBLIC_GOOGLE_AUTH=true`. Add your site URL under Authentication > URL configuration.

## Scripts

`npm run typecheck`, `npm test`, `npm run build`. Lint is not set up yet.

## Not included yet

Eventbrite and weather providers, preferences and history screens (tables exist), ESLint, a demo-data mode (the app never serves sample data).
Durations and costs are category estimates; opening hours are only used when OSM lists a simple value.
Please respect the Overpass and Nominatim usage policies; add caching before heavy traffic.
