# Worldwide explorer
## Global Spatial Map
- [x] Stage 1: verify NASA temperature slices, worldwide rendering, same-slice samples, history and A/B integration.
- [x] Stage 2: prepare and independently verify a native-resolution temperature Sen slope product.
- [x] Stage 3: verify and enable additional environmental variables individually.
- [x] Stage 4: verify period averages, annual-frame animation and feasible grid outlines.
- [x] Validate real-data desktop/mobile preview; leave production unchanged.
- Limits: trend/average periods are fixed to 2005–2024; annual/monthly snapshots have verified coverage through 2025. Annual completeness inherits NASA source aggregation; no significance map. NASA outages can prevent a new frame; the old period stays labelled. Mobile world view shows a narrower extent; reset, zoom and pan remain available. Spatial verification details are in SPATIAL_VERIFICATION.md.
## Air Quality extension
- [x] Add verified public GEOS-CF point adapter and strict versioned PM2.5 AQI calculations.
- [x] Add shared-location Air Quality views, comparisons, metadata and exports.
- [x] Test actual NASA point extraction, scientific safeguards and desktop/mobile setup states.
- [x] Deploy/connect the Python adapter (Render Free; live Air Quality verified through the app 2026-11-14).
## Solar extension
- [x] Add validated GHI units, RE requests, solar year limits and isolated cache metadata.
- [x] Integrate monthly solar charts, annual totals, A/B comparisons and exports.
- [x] Extend forecasting to a fifth nonnegative target and test real NASA solar data.
## Forecast extension
- [x] Implement pinned Python models, chronological backtests, calibrated intervals, and job API.
- [x] Add Forecast tab, snapshot-safe progress, monthly charts, metrics, tables, and exports.
- [x] Test scientific safeguards and real NASA forecasting; document hosting and deployment status.
- [x] Connect a separately hosted Python service (live T2M forecast verified through the app 2026-11-14).

- [x] Configure Google Maps and protected place search.
- [x] Add world selection, presets, coordinates, and shared modes.
- [x] Implement common-year comparisons, partial failures, and snapshot state.
- [x] Add metadata-aware CSV/JSON exports and regression tests.
- [x] Verify real NASA flows and desktop/mobile layout; report Maps verification limitation.
## Verification limits
- Air Quality: verified official NASA FileSpec v2 hourly midpoint averages and surface layer 72, and EPA May 2026 document EPA-403/B-26-003. Real public NASA extraction returned 120 hours each for Johor Bahru (grid 1.5,103.75) and London (51.5,-0.25), covering 2026-11-13 09:00 to 2026-11-18 09:00 UTC; 95 future hours remained at test time, not five additional days. Complete first windows produced estimated indices 91 and 57. Metadata, time and selected concentration chunk identities verified before/after reads. 44 TypeScript and 30 Python tests passed; browser verified Air Quality setup-needed, historical NASA results, no console errors and mobile no-overflow. Result charts/export browser flow and hosted end-to-end NASA retrieval remain unverified because no hosting address is configured. Updated existing service Docker deployment instructions; no NASA credentials needed. Initialization remains null, latest mutable store checked per fetch, no local station validation or prediction intervals. A/B extraction is atomic: a source error requires retrying the batch rather than retaining one newly extracted point.
- Solar: 38 TypeScript and 17 Python tests passed; automatic app checks passed. Real NASA RE metadata verified kW-hr/m^2/day (API v2.10.0, SYN1DEG). Browser completed 20-common-year Johor Bahru/London solar analysis, monthly/common/JSON downloads, 1984 minimum, five-target forecast selection and mobile no-overflow. Local real 12-month solar ML: test MAE 0.32497 kWh/m²/day, skill +17.66%, coverage 95.14% at nominal 95%, 288 errors. This is local computation, not hosted deployment; forecast buttons remain disabled until the public service address is configured, and the Python service must be redeployed with solar support.
- Forecast: 15 Python tests and 30 TypeScript tests passed; automatic app checks passed. Real NASA 2000–2024 Johor Bahru data ran all four targets at 3/6/12/24-month horizons and 80/90/95% levels. Temperature 12-month ML test MAE 0.5099 °C, skill +8.79%, coverage 88.19% at nominal 95%; humidity ML skill −8.19% was retained honestly.
- Browser verified Forecast controls, invalid horizon rejection, explicit unconnected-service error, historical NASA analysis still working, and no mobile overflow or browser errors. Result charts/backtest/download UI and full app-to-host flow remain unverified: no hosted service is configured, and temporary intercepted-response display checks did not complete. Model computation and export logic were tested separately; no demo scores are shipped.
- Google Maps clicks, live Places search, and social sign-in require an authorized deployed origin and remain unverified.
- Live NASA check: default 2005–2024 temperature comparison (Johor Bahru/London), three comparison exports, stale settings and mobile overflow; 27 tests passed.
