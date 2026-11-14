# Worldwide explorer
## Solar extension
- [x] Add validated GHI units, RE requests, solar year limits and isolated cache metadata.
- [x] Integrate monthly solar charts, annual totals, A/B comparisons and exports.
- [x] Extend forecasting to a fifth nonnegative target and test real NASA solar data.
## Forecast extension
- [x] Implement pinned Python models, chronological backtests, calibrated intervals, and job API.
- [x] Add Forecast tab, snapshot-safe progress, monthly charts, metrics, tables, and exports.
- [x] Test scientific safeguards and real NASA forecasting; document hosting and deployment status.
- [ ] Connect a separately hosted Python service (requires hosting URL and service credential).

- [x] Configure Google Maps and protected place search.
- [x] Add world selection, presets, coordinates, and shared modes.
- [x] Implement common-year comparisons, partial failures, and snapshot state.
- [x] Add metadata-aware CSV/JSON exports and regression tests.
- [x] Verify real NASA flows and desktop/mobile layout; report Maps verification limitation.
## Verification limits
- Solar: 38 TypeScript and 17 Python tests passed; automatic app checks passed. Real NASA RE metadata verified kW-hr/m^2/day (API v2.10.0, SYN1DEG). Browser completed 20-common-year Johor Bahru/London solar analysis, monthly/common/JSON downloads, 1984 minimum, five-target forecast selection and mobile no-overflow. Local real 12-month solar ML: test MAE 0.32497 kWh/m²/day, skill +17.66%, coverage 95.14% at nominal 95%, 288 errors. This is local computation, not hosted deployment; forecast buttons remain disabled until the public service address is configured, and the Python service must be redeployed with solar support.
- Forecast: 15 Python tests and 30 TypeScript tests passed; automatic app checks passed. Real NASA 2000–2024 Johor Bahru data ran all four targets at 3/6/12/24-month horizons and 80/90/95% levels. Temperature 12-month ML test MAE 0.5099 °C, skill +8.79%, coverage 88.19% at nominal 95%; humidity ML skill −8.19% was retained honestly.
- Browser verified Forecast controls, invalid horizon rejection, explicit unconnected-service error, historical NASA analysis still working, and no mobile overflow or browser errors. Result charts/backtest/download UI and full app-to-host flow remain unverified: no hosted service is configured, and temporary intercepted-response display checks did not complete. Model computation and export logic were tested separately; no demo scores are shipped.
- Google Maps clicks, live Places search, and social sign-in require an authorized deployed origin and remain unverified.
- Live NASA check: default 2005–2024 temperature comparison (Johor Bahru/London), three comparison exports, stale settings and mobile overflow; 27 tests passed.
