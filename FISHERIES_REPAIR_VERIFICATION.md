# Fisheries repair preview verification — 2026-11-14

## January SST installation and artificial demonstration — supersedes old blockers below
- Owner NetCDF SHA-256 `d8d49bf5c558fd74e0c7fafd13cae3fb87474f10735ba481624c0e81ffb58832`, 8,034,173 bytes. NASA Aqua MODIS SST R2019.0, 2160 × 4320 north-first/west-first, degree_C, packed scale 0.005, fill -32767, packed range -1000–10000. CF decode, qual_sst 0/1, -2–45°C and fixed global-land-mask 1.0.0 applied; 5,069,007 valid native ocean cells.
- Spherical weighted 1° overview, ≥70% eligible coverage, null gaps; 36,277 valid overview cells. Stored exact JSON bytes in Lovable Assets: map 782,762 bytes / SHA-256 `dd520e2e103b733e848cfbd55cb8fba3c95125fd69f1bd3041a7c7d34e08c2d0`; histories 2,200 bytes / `341bb4a71f2ec41dc76cc99f88111ae27f3ed0eac77c26f35fe335c148493157`.
- Installed chlorophyll bytes/hashes retained unchanged. Source coordinate endpoints match both manifests. SST original observation bounds `2024-01-01T00:10:01.000Z`–`2024-02-01T02:59:59.000Z` are separate from preparation time.
- Native SST: Johor 28.244998931884766°C, South China Sea 27.69999885559082°C, Malacca 29.78999900817871°C. Existing chlorophyll parity checks still pass. One month gives no eligible trend.
- Playwright fresh public visitor: 2 nonempty maps, 10 symbols (same 5 schematic ocean positions on both maps), correct separate legends/versions, regional initial extent, paired zoom, honest symbol tooltip. Toggle removes all symbols without removing either raster. Real selectors show one raster; combined shows two. Fullscreen retains disclosure. Selected point reads both sources separately, including genuine missing chlorophyll rather than substitution.
- Genuine CSV download contains SST and chlorophyll only, no artificial fish records. 390px phone layout has no horizontal overflow. No page errors. All 201 tests passed including trend parity, CCDF and pinned attenuation tests; automatic build OK.
- Illustration config is separate source code with artificial/nonprediction/nonobservation flags. No artificial intensity layer or image exporter added; no scientific fish scoring. Files are prepared once, not supplied by visitors. No new service, credentials or paid resources; not published.
- Remaining limits: January 2024 only; world maps are 1°, not native 9 km; only six prepared point/region histories per product. Chlorophyll raw file was not newly supplied, so its native preparation evidence remains the prior verified bundle. No unattended refresh or multi-year fish/climate claim.

## Verified
- All 111 TypeScript tests passed before the final independent-source test was added; final total is recorded in the completion check.
- Automatic app check: build OK.
- Clean browser context, NOAA and NASA requests blocked: Fisheries reads the local manifest, displays “No prepared dates available” and an honest no-dataset alert; retry works. History requests explicitly report unsupported location/period. No external NASA or NOAA request occurred and no browser error occurred.
- Desktop 1280×1800 and phone 390×844: no page-width overflow. Phone Fisheries detail inspected after scrolling, not just the page header.
- Active Fisheries source contains no CoastWatch/ERDDAP URL; its former server proxy has been removed entirely. Browser-only app-asset functions need no server secret. Historic migration prose/tests may name the former provider.
- Public CMR identified January 2024 MODIS Aqua monthly 9 km SST R2019.0 (11µm daytime) and chlorophyll 2022.0 granules. NASA downloads returned Earthdata authentication pages/401, not scientific NetCDF. No NASA credential is configured; no unattended refresh is configured.

## Not accepted / remaining blocker
No real scientific bundle has been prepared. There are **no available map dates or histories**. The empty manifest is a truthful installation state, not NASA data. Therefore real map display, numeric source parity, history exports, native quality/masks, real bundle refresh-failure survival and one-source map outage resilience remain unverified. Obtain authenticated NASA files or configure Earthdata in a supported preparation environment, run the preparation command, then repeat scientific/browser acceptance before publishing. No paid resources were created and production was not published.

Preview: https://id-preview--86558542-1048-4fb3-bd3f-64cd5e180db9.lovable.app