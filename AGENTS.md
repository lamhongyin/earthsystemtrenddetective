<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Earth Trend Detective
- Scientific logic lives in `src/lib/trend/` (pure TS ports of the SciPy starter), validated by `trend.test.ts` against a SciPy-generated fixture; keep parity tests passing when touching stats.
- NASA POWER is fetched via a same-origin server function proxying only the fixed monthly endpoint, because browser CORS/deploy behavior is not guaranteed.
- Common-year alignment and deterministic interpretation live in the trend domain module; all comparison statistics are recomputed after alignment to keep periods identical.
- Google Maps renders through an asynchronous browser callback; place search is an explicit authenticated server function with bounded results and no persistent geocoder cache to protect billable access.
- NASA analysis stays public and uses submitted snapshots, per-location outcomes, and keyed query deduplication; search authentication must not gate analysis.
- Google-derived place labels are transient display content and are replaced by selected-point labels in exports to avoid distributing provider text.
- Forecast training lives in a separately hosted pinned Python service under `services/forecast`; TanStack server functions proxy its fixed configured URL with a server-only credential because the app runtime cannot execute Python.
- Forecasting uses direct lead-specific trees and a seasonal benchmark, expanding origins and disjoint validation/calibration/test target blocks; keep scientific acceptance tests passing and never substitute trend extrapolation when the service is unavailable.
- Forecast results, charts and exports use immutable submitted monthly snapshots; process independent fits sequentially and ignore or cancel stale jobs to bound work and prevent mislabeled results.
- Solar normalization lives in `src/lib/trend/solar.ts`; accept verified energy units, reject ambiguous flux units, preserve zeros and flag negatives so historical comparisons and forecasts share one canonical monthly target.
- NASA cache identities include community, monthly resolution and canonical-unit version; solar uses RE while weather retains AG to prevent incompatible source/unit reuse.
- Air Quality uses a separate GEOS-CF v2 public Zarr Python adapter in the existing hosted service; authenticate its app proxy with the server-only service credential because Workers cannot execute xarray.
- PM2.5 indices use versioned EPA decimal truncation/half-up rounding and strictly complete UTC windows; keep the air-quality scientific tests passing to prevent incomplete or model-only values being labeled official AQI.
- Extract A/B GEOS-CF points as one verified snapshot with time and selected-chunk identities before/after reads; bounded point caches key those identities so changing latest runs cannot silently mix results.
- Forecast hosting targets a free sleeping single instance: bind $PORT, lazy-load air-quality libraries, and surface cold-start/restart job loss honestly instead of retrying.
- Spatial snapshots use a bounded public NASA image-service proxy and nearest-cell numeric canvas tiles; no forecast service or point-request global mosaics, to preserve source alignment and independent availability.
- Offline spatial preparation uses native annual grids and actual-year Sen slopes with all 20 years required; ship binaries and source-hash manifests, never recompute worldwide trends on page requests.
- Spatial and historical views share A/B point state; rainfall annual maps retain accumulated totals while monthly maps divide totals by calendar duration, to avoid confusing rates with totals.
- Hotspot screening runs in a cancellable browser worker over hash-verified annual NASA arrays; keep OLS screening separate from Sen-slope spatial products and retain exact annual evidence for every selected cell.
- Hotspot thresholds use one jointly eligible population, true-cell spherical area weights and inverse-CDF quantiles; four-edge grouping wraps longitude while missing gaps remain disconnected, to preserve reproducible relative rankings.

- Fisheries serves independently loaded checksum-verified versioned NASA bundles from app assets; offline Python preparation publishes the manifest last, so upstream outages cannot invalidate saved data and request runtimes never execute Python.
- Fisheries MODIS source grids, native-cell histories and area-weighted overview/region coverage remain explicit and distinct; descriptive month-effect slopes never imply significance or fish occurrence, preventing old MUR assumptions or arbitrary-point history substitution.

- PV calculations reuse canonical POWER solar point records and shared A/B coordinates; immutable constant-capacity/PR snapshots calculate horizontal resource electricity in pure TypeScript, to avoid duplicate efficiency/loss factors and forecast-host dependence.
- PV annual statistics use complete 12-month electricity totals and common-year alignment before fitting existing trend helpers, to preserve calendar duration and comparison parity.
- Rainfall source investigations use separate canonical calendar-month depth records in `src/lib/rainfall`, strict reviewed CSV imports and native-support matching; never feed depths to rate annualisation or substitute POWER for IMERG.
- IMERG cloud catalogue discovery is not data retrieval; expose imports honestly until authenticated NASA numeric access is verified, and retain immutable source hashes, intervals and support for reproducible monthly research without a Python runtime.
