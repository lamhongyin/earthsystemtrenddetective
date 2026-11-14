# Welcome to your Lovable project

## Fisheries NASA-direct repair

Fisheries now serves checksum-verified prepared NASA MODIS assets, not NOAA/ERDDAP requests. NASA downloads are a separate bounded Python preparation step; see [FISHERIES_PREPARATION.md](FISHERIES_PREPARATION.md). No verified scientific bundle is installed yet: authenticated Earthdata files are required before map/history acceptance or publication. No unattended refresh is configured.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## Worldwide explorer

NASA analysis is public; Google place search requires a Cloud Auth session (email/password, Google, or Lovable). No profile table or NASA database is used. Connect Google Maps in Lovable to provision browser and server credentials. Keep server credentials secret. The managed browser key supports authorized Lovable domains; custom domains require an appropriately restricted user-owned key. Maps/Places usage is metered; the gateway has workspace quotas but browser map usage is separate.

The map loads Maps JavaScript asynchronously using a callback and tracking channel, without Places browser libraries or a map ID. Google copyright/logo remain visible. Search submits explicitly to Places API (New), with up to eight suggestions; selecting a country chooses a representative point, never an average. No reverse lookup is needed for clicked/manual points. Search content is held in memory only; Google-derived text is replaced with selected-point labels in exports. End users can review Google terms and privacy links beside search. Google Maps is not supported in Google prohibited territories. Review current Google service terms for your billing jurisdiction before distribution, including EEA-specific Places restrictions. No geolocation tracking or AI use of Maps content is implemented.

NASA requests use the fixed monthly point endpoint. Query keys include parameter, exact coordinates and years; comparison runs at most two requests concurrently and identical points deduplicate. Successful payloads carry UTC retrieval timestamps and are reused for 24 hours in the browser and best-effort worker memory (not guaranteed across worker restarts). Retry-After is displayed and respected before a location-specific manual retry; there are no automatic upstream retry loops. Upstream timeout is 90 seconds, subject to hosting execution limits. Returned geometry is shown separately and is not treated as authoritative grid-cell identity.

Comparison uses the intersection of complete years, requires eight common years, recomputes all statistics, preserves gaps, and never fills missing observations. Individual exports retain all valid months/all complete years; comparison exports contain common years only. CSV values retain full precision, place text is formula-safe, and unavailable JSON numbers are null. Original SciPy fixtures use a 1e-9 relative tolerance; tests also cover common-year alignment, interpretation, coordinates, and exports.

Google Maps rendering and live Places requests cannot be tested from the agent sandbox. Validate map clicks, search, attribution and A/B marker behavior on an authorized deployed origin. Coordinate/preset NASA flows can be verified locally without calling Google.

## Forecast service

## Solar resource

GHI uses NASA POWER `ALLSKY_SFC_SW_DWN`, RE monthly community, beginning in 1984. Validate response metadata and normalize documented kWh/Wh/MJ daily-energy units to kWh/m²/day. Ambiguous W/m² and unknown/missing units are rejected, not relabeled. Negative valid-range solar values are flagged/excluded, seasonal zeros retained. Annual mean daily energy is day-weighted; annual/monthly energy totals multiply by actual calendar days. Twelve valid months per annual record and eight common years per comparison remain required. Cache/source metadata includes community, temporal resolution and canonical-unit version. Forecasting includes five targets, solar nonnegative postprocessing in every evaluation block, and deterministic monthly total/bound rescaling; annual uncertainty is unavailable. Redeploy the separate Python service to receive the solar API extension. Its public hosting address is still required before live forecasting can be enabled.

Forecast adds real direct multi-step gradient-boosted regression and a seasonal naive benchmark, not an AI text model or a historical trend extrapolation. Python is **not** run by the published JavaScript app. Deploy `services/forecast` separately on a Docker-capable host with a persistent single service instance. See `services/forecast/README.md` for configuration, security, scientific policy, tests and limitations. Set server-only `FORECAST_SERVICE_URL` (HTTPS base URL) and `FORECAST_SERVICE_TOKEN` in Lovable secrets, with the same token on the Python service. No service credential enters the browser. Without these settings, Forecast displays an explicit unavailable-service message while historical analysis stays usable.
