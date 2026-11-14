# Current update: hosted ITU originals and short-interval rainfall research (2026-11-14)
- Owner states redistribution permission exists and authorizes hosting. Documentation has not been independently reviewed; the UI makes that distinction. Earlier local-only statements below describe the preceding implementation, not the current serving mode.
- Uploaded originals matched the pinned SHA-256 hashes exactly (R001 28,182,430 bytes; h0 171,662 bytes). Lovable Assets pointers serve these files; no raw climatology grids are committed. One-click downloads still pass the original worker's hash, shape, finite-value and seam checks. Calculated exports still exclude sampled source fields. Local file input and cache failure handling remain available.
- Fresh Chromium one-click flow returned 289/289 valid nodes and 544 filled contour pieces. Point (2N,103E) displayed Ap=A0.01=53.0846 dB and a nonempty curve. Existing genuine monthly IMERG demonstration and monthly CCDF still load.
- Added local, worker-parsed interval-start UTC mm/h CSV imports and strict observed-time CCDF. Complete 30-minute/gauge windows only; earliest 70% trains empirical quantile transfer, later windows test it. Estimates describe a distribution, not reconstructed minutes, validated extremes, annual availability or ITU inputs. This is an exploratory method, not an accepted ITU integration-time conversion.
- All 212 tests passed, including pinned ITU parity, cache/export checks and five new rainfall scientific checks. Latest automatic compilation reported build OK.
- Browser rainfall investigation used explicitly synthetic temporary CSVs only: 30 half-hour windows, 900 minutes, 21 training / 9 held-out windows. UI imports, curves and validation table worked with no page errors. Actual half-hourly IMERG and one-minute gauge files have NOT been supplied, despite the owner's intention to provide both; real-data conversion validation remains blocked.
- No publication/deployment, paid service or new Python runtime. Source-grid asset installation is the explicitly requested exception to previous no-hosting requirements. Rainfall files stay session-local.
- Final rerun after shortening point tooltip percentages: 390px page has no horizontal overflow; no page errors. Latest automatic build OK. Final focused regression: 94 tests passed. Actual rainfall validation still awaits both rainfall files; screenshots of synthetic controls are not evidence of real-data conversion accuracy.

## Previous implementation evidence (historical)

# Monthly CCDF and browser-local ITU engineering verification

## Implemented
- Code-review correction (2026-11-14): earlier grid CSV downloads did include sampled R001/h0/hR fields despite the calculated-only wording. These three source-climatology columns and their values are now excluded by a dedicated export helper. Coordinates, calculated Ap/A0.01, k/alpha/specific attenuation, effective path, elevation, validity/reason, headroom, percentage, immutable scenario and source hashes remain. Exact single-point source evidence is still visible for engineering audit; contour GeoJSON and curve remain calculated-only.
- Remove immediately resets worker memory and UI readiness/results, then separately reports saved-storage deletion success or failure. Failed deletion explicitly warns that saved storage may remain; it never claims device storage was cleared. Failed remember writes turn remember off without destroying verified session grids. Failed/corrupt restore returns not-ready, remember-off and offers clean session-only file selection. Transaction aborts and blocked opens are handled.
- Focused synthetic worker checks cover failed deletion, failed writes, unavailable/failed reads and incomplete corrupt cache (5 tests); export-schema check excludes both source column names and sentinel source values. All 40 focused export/storage/model/local/CCDF tests passed. These simulated failures are worker-level checks, not claims that every browser's quota/blocked-storage UI was manually exercised.
- Genuine original files reselected through Chromium inputs after these changes: 289-row grid CSV has no R001_mm_h/h0_km_ASL/hR_km_ASL columns. Node (2N,102E) retains Ap=52.52312449241184 dB. Nonempty filled map screenshot inspected; single-point evidence still renders. Opt-in, reload/full verification restore and successful remove all exercised through UI; calculation disabled after remove. No page errors or non-GET requests during local actions. A first broad network assertion included unrelated reload/startup traffic; repeated checks separated startup and recorded zero local-action non-GET requests.
- Final regression: 207 tests in 22 files passed; latest automatic preview build OK. No source originals added to project assets/repository, publication or deployment. Actual originals remain only in /tmp.
- Strict empirical monthly survival: ties grouped, numerical thresholds, valid zeros retained, negative/missing/nonfinite totals excluded, maximum tail exactly zero.
- Immutable submitted monthly results; comparison curves use only valid common months after existing geographic checks. Calendar-month filter, linear/log display, exact threshold evaluation and provenance-bearing CSV.
- Engineering section now evaluates visitor-selected official text files entirely on the visitor's device: verified hashes/shape/finite values/seams, worker parsing and bounded map computation, bilinear lookups, filled triangular isobands, map-click or entered-point evaluation, anchored model curve and calculated-only CSV/GeoJSON/provenance exports.
- Pure P.838-3 coefficient, P.618-14 §2.2.1.1, P.530-19 §2.4.1/§2.4.2.1 and WGS84 GEO numerical helpers remain pinned and independently checked. Satellite reference/GEO modes and terrestrial hypothetical reference links use explicit assumed ASL heights.

## Official sources acquired and inspected
- https://www.itu.int/dms_pubrec/itu-r/rec/p/R-REC-P.837-8-202509-I!!ZIP-E.zip
  - Archive SHA-256: d56a525fea283205ff478f55476d40ea55436adf51d3042c1533cd4e0626bc85.
  - R001.TXT: 1441 × 2881, latitude south-to-north −90…90, longitude −180…180, 0.125°; duplicate longitude seam included; mm/h, observed range 0…161.191.
  - Source field SHA-256: 360cc6fa81df0403ba00a881cc2e0d58cd67123187dd3244f79273bdb330e553.
  - Checked nodes (2°N, 102°E): 96.472 mm/h; (2°N, 104°E): 106.508 mm/h.
  - P.837-8 Annex 1 states GPCC V2015 land 1951–2000 and ERA Interim water 1979–2014. Bilinear interpolation is prescribed. These are not the monthly NASA study dates.
- https://www.itu.int/dms_pubrec/itu-r/rec/p/R-REC-P.839-4-201309-I!!ZIP-E.zip
  - Archive SHA-256: 0e16ce47866ce3131ccfcd52a8a37877faa5323ceaf486f136e95c2d1ddeb611.
  - h0.txt: 121 × 241, north-to-south 90…−90, longitude 0…360, 1.5°, km ASL. Rain height = h0 + 0.36 km; bilinear interpolation prescribed.
  - Source field SHA-256: a94d7369568786fdc6de57eeddadab59202878cb415c882428b9b8230813cac3.
  - Checked node 1.5°N,103.5°E: h0=4.604 km ASL.

## Rights distinction and local technical solution
The earlier blanket unavailable state has been replaced, not treated as a grant of rights. ITU website terms allow certain acknowledged personal/educational/non-commercial uses while reserving rights and restricting distribution/derivative works:
https://www.itu.int/en/about/Pages/terms-of-use.aspx

This implementation distributes calculation code only. Users select their own official extracted R001.TXT and h0.txt; no grid files, arrays, archive downloads or prepared climatology assets are served by the website. Selecting a file transfers it only to a local worker, not a server. No fetch/XHR/analytics call exists in the local-data modules. Session-only by default; explicit IndexedDB opt-in stores original files locally and restore repeats full verification. Remove always clears worker memory, file controls and results; local storage is cleared when deletion succeeds, otherwise a separate warning states saved data may remain. Copyright permission for use or calculated-output redistribution is not asserted. Public bundling remains a separate permission question. Downloaded official test originals remain under /tmp only.

## Numerical evidence
- Independent official workbook CG-3M3J-13-ValEx-Rev8.3.0.xlsx, sheet P.618-14 A_Rain rows 23/26/32: exact supplied R0.01 and hR used solely as test inputs. gamma=1.58130839366869 dB/km, LE=4.29901737938415 km, A0.01=6.79807226654774 dB, A1=0.495317069022985 dB, A0.1=2.18584742205216 dB, A0.001=14.8998224790914 dB; tolerance 5e−10 absolute via 9-place assertions.
- Workbook URL: https://www.itu.int/en/ITU-R/study-groups/rsg3/rwp3m/Validation%20Example/CG-3M3J-13-ValEx-Rev8.3.0.xlsx
- P.530-19 equations 32–36 independently evaluated with Python scalar arithmetic and P.838 Table 5 rounded k/alpha, for horizontal 18 GHz, 10 km, R=100 mm/h: A0.01=52.93929779695887 dB, A0.1=19.980237815617418 dB. Absolute tolerances 0.02/0.01 dB account for table-rounding, not a same-function fixture. No old P.530 revision used as reference.
- Tests cover percentage/frequency limits, internal equation32 bounds, strict p=.01 anchoring, zero/missing rainfall, low elevation, polarization, GEO visibility and wet-snow masking.

## Current limits
- Hypothetical terrestrial reference links only; actual endpoints, terrain, obstruction, multipath and combined wet-snow model are not implemented. Wet-snow cases are masked, not silently assigned liquid-rain attenuation.
- Extents within ±85° latitude and ±180° longitude, maximum 40° each side. Dateline-crossing requests must be split; source lookup wraps correctly. At most 4,096 cells, 64 bands and 32,768 contour pieces. Calculation spacing 0.125°–5°, separate from native h0 1.5° support. Non-integral extent endpoints use a shorter final cell; exact coordinates are exported.
- Piecewise-linear triangular isobands are display interpolation, not finer observations. A cell with any invalid vertex stays entirely unfilled (conservative boundary), never bridged. Under-range starts at genuine zero; over-range band remains explicit. Fade allowance inserts its exact contour level for meeting/headroom classification.
- Exact original hashes only: altered/resaved originals or newer/older revisions are rejected with extraction instructions. Cache portability/storage quota vary by browser; session-only evaluation remains the default.
- No source-grid redistribution, new service, paid resource, publication or deployment. Local processing is not a legal opinion or copyright grant.

## Concrete visitor checks with genuine temporary files
- Chromium file inputs selected actual /tmp/itu/r001/R001.TXT (28,182,430 bytes) and /tmp/itu/maps839/h0.txt (171,662 bytes). Both passed original SHA-256, shape, finite/nonnegative values and duplicated-seam checks. Workers kept parsing/computation off the UI thread.
- Default 20 GHz horizontal, 30° fixed elevation, 0 m ASL, p=.01%, extent 102–104E/1–3N, .125° grid: 289/289 valid nodes and 544 nonempty filled contour pieces. Exported (2N,102E) R001=96.472, Ap=A0.01=52.52312449241184 dB; (2N,104E) R001=106.508. Native h0 point (1.5N,103.5E)=4.604 km, hR=4.964 km.
- Real map click produced point intermediates and an unsorted naturally decreasing log-percentage model curve. Entered (1.5N,103.5E): curve contains p=.01 exactly, Ap=54.34001825754609 dB, 62 rows. Curve and grid CSVs and calculated GeoJSON/provenance successfully downloaded without full source arrays/original files; the prior grid CSV did contain sampled climatology fields, corrected and retested above.
- Terrestrial horizontal 18 GHz/10 km/30 m ASL/p=.01%: 289 valid nodes and 575 contour pieces. First antenna 2,000 m ASL: all 289 nodes masked combined_wet_snow_model_required, no contours bridging the holes.
- GEO −77° longitude over the study region: all 289 nodes geo_invisible; GEO 103°: 289 valid nodes, 545 contour pieces, varying local elevation. Minimum elevation 89.99°: all 289 nodes masked below_minimum_elevation.
- Satellite p=2% accepted; mode change to terrestrial retains p=2% and rejects it. Previous result is stale, not relabelled. Changing frequency during a larger pending request cancels/ignores it and keeps the previous submitted 20 GHz map unchanged.
- Fade margin 60 dB retained in GeoJSON/provenance; point (2N,102E) headroom=7.47687550758816 dB. Matching bands flagged, not overall availability.
- Session default: zero IndexedDB file entries; reload requires selecting files again. Opt-in: one verified-file entry, reload re-verifies both original files and restores ready state. Opt-out clears saved entry while keeping session data. Remove clears memory/storage/results, calculation disabled. Wrong text hash rejected and prior rainfall readiness cleared.
- Network monitoring after entry into the rainfall section showed no POST/PUT requests during local file selection, calculation, inspection, storage or exports. Existing unrelated forecast connection checks can run on app startup (134-byte requests); they contain no local file/array content. Local-action checks after startup recorded zero non-GET requests.
- Real monthly IMERG demonstration still loads N=240; CCDF scientific tests retained. Desktop/mobile map and point screenshots inspected; 390px has no horizontal overflow. No browser page errors in both local end-to-end checks.
- Final regression run: 199 tests in 19 files passed, including existing SciPy trend parity, solar, PV, Fisheries, air quality, forecasting, hotspots and CCDF. Latest automatic preview build: build OK. Public content routes retained app-specific metadata. No publish/deploy performed.
