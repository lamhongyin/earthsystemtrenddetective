# Global Spatial Map — verified preview

Open **Spatial Map** beside Historical analysis, Forecast and Air Quality.
Preview: https://id-preview--86558542-1048-4fb3-bd3f-64cd5e180db9.lovable.app
Production was not published or replaced. No new services, accounts, secrets or paid resources were created.

## Stage status

1. **Completed:** real temperature annual/monthly rasters, fixed-scale legend, opacity, native-cell values, historical graph action, shared A/B locations, desktop/mobile controls.
2. **Completed:** global temperature Sen slopes for 2005–2024, native grid, valid-year counts, zero-centred scale and downloadable provenance.
3. **Completed:** precipitation, humidity, wind and solar; annual/monthly snapshots and prepared 2005–2024 slopes.
4. **Completed with bounded scope:** 2005–2024 averages, annual-year animation (also steps the chosen month across years), grid outlines when zoomed in. Arbitrary trend/average periods and consecutive-month animation are not implemented.

## Exact sources

All services are under `https://gis.earthdata.nasa.gov/portal/rest/services/POWER/`:

| Service | Verified variables | Coverage |
|---|---|---|
| `POWER_ANNUAL_METEOROLOGY_LST/ImageServer` | T2M, PRECTOTCORR_SUM, RH2M, WS10M | 1981–2025 |
| `POWER_MONTHLY_METEOROLOGY_LST/ImageServer` | T2M, PRECTOTCORR_SUM, RH2M, WS10M | January 1981–December 2025 |
| `POWER_ANNUAL_RADIATION_LST/ImageServer` | ALLSKY_SFC_SW_DWN | 1984–2025 |
| `POWER_MONTHLY_RADIATION_LST/ImageServer` | ALLSKY_SFC_SW_DWN | January 1984–December 2025 |

Meteorology native/display grid: 0.5° latitude × 0.625° longitude, 576 × 361 numeric raster. Solar: 1° × 1°, 360 × 180. NASA service nominal pixel-size fields alone are insufficient: exact TIFF spacing and sampled cells were checked. `adjustAspectRatio=false` is essential to preserve these coordinates. The time slice is explicitly selected using metadata StdTime values (period-end dates), not the default service image. Sources use local solar time. Meteorology is MERRA-2 reanalysis; solar is CERES SYN1deg.

Temperature source C → °C. Humidity %; wind m/s. Precipitation source accumulated mm: annual retained as mm/year; monthly divided by actual month length for mm/day. Solar mean W m-2 multiplied by 0.024 for kWh/m²/day. Fill -999 and nonfinite values are missing, not zero.

## Evidence

- Browser: 2025 world temperature rendered as numeric canvas tiles; no page errors. Northern selected cell 51°N, 0° gave 11.813 °C; southern selected cell −34°, 18.125° gave 16.937 °C. Southern January value changed from 19.500 °C in 2025 to 19.312 °C in 2024.
- Direct same-slice 2024 identify checks at 51°N, 0° and −34°, 18° agreed with exported TIFF values within 0.001 source units for every parameter. Temperature: 11.65625 / 16.499998 °C; rainfall accumulated 858 / 699.999939 mm; humidity 86.75 / 81.249992%; wind 5.4375 / 6.1406245 m/s; solar flux 131 / 218 W/m² → 3.144 / 5.232 kWh/m²/day.
- All five monthly maps and all five trend layers rendered with selected-cell values. Annual rainfall popup displayed mm/year; trend displayed change in annual total per decade. Humidity trends use percentage points/decade.
- SciPy independent `theilslopes` checks agreed at three representative cells per parameter within float32 precision. Temperature 2005–2024: Johor +0.397727 °C/decade, London +0.438763, Sydney +0.234375. Missing-year test confirms actual year differences rather than array positions.
- Prepared averages require 20/20 finite annual values and average years equally. Browser loaded the real temperature average and advanced annual animation from 2024 to 2025 using the fixed scale.
- Browser verified location B activates existing comparison mode, and the historical action fetched a real 240-month solar point record and displayed its annual graph/results. No forecast endpoint requests occurred in the spatial flow.
- Desktop 1280 px and mobile 390 px: visible real raster, collapsible settings, no horizontal overflow, no page errors. Fullscreen, zoom, pan and world reset exercised.
- 54 existing/new tests passed before the final annual-rainfall safeguard was added; the final selective run passed 33 tests, including all 7 spatial scientific tests. Automatic preview checks report build OK.

## Reproduction and limitations

`bun scripts/prepare-spatial.ts --all` prepares the global products sequentially from annual image grids. `public/spatial/*-manifest.json` records exact source, years/timestamps, retrieval time, original TIFF SHA-256 hashes, conversions, grid, estimator and representative annual sequences. Products are served statically; the Python forecast service is not involved. Snapshot fetching uses a bounded same-origin server function and native-resolution TIFF data; canvas tiles render only the displayed map area. One small global native raster is downloaded per slice rather than many point requests.

Trend completeness means all 20 finite annual source values; NASA’s internal annual monthly completeness is inherited, not independently reconstructed. Trends use Sen slope, but no global Mann–Kendall significance tests. Little change is a magnitude category within 10% of the positive legend bound, not statistical insignificance. Fixed scales clip outlying colours while preserving numeric values.

Historical point records can differ because of source processing, quantization, sampling and aggregation; the map explicitly discloses that distinction. No area means, warnings or forecasts are inferred. Arbitrary periods are unavailable, not simulated. Source outages retain an honestly labelled old raster and offer Retry; animation stops on a failed frame. Stale completion guards prevent earlier map submissions from replacing later submissions.

OpenStreetMap basemap attribution is visible; public service quotas/availability still apply. The exact poles are not visible in Web Mercator. Forecast and Air Quality server code were unchanged; their hosted live training/extraction was not repeated in this spatial-map verification.