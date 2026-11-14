# Earth System Trend Detective Python forecasting service

## Deploy separately

The app's Worker runtime cannot run this Python service. Deploy this folder's Dockerfile on a Docker-capable host (e.g. a private container service behind HTTPS). Python 3.13.5, scikit-learn 1.7.2 and NumPy 2.2.6 are pinned. Run **one Uvicorn worker and one instance**: jobs/caching are bounded in-memory, not a distributed queue. Restart loses jobs; the app surfaces expiry and requires fresh submission. Do not use short-lived request-only hosting: training continues after the job submission response.

Configure on the service:
- `FORECAST_SERVICE_TOKEN`: strong random secret, required; never commit or expose it.
- `FORECAST_ALLOWED_ORIGINS`: comma-separated exact frontend origins. The app uses same-origin server proxies, so direct browser calls are normally unnecessary. Never use wildcard origins with private credentials.

Configure the app's server secrets:
- `FORECAST_SERVICE_URL`: the service's HTTPS base URL (no `/jobs` suffix).
- `FORECAST_SERVICE_TOKEN`: the identical secret.

`GET /health` is public and returns version/status only. `POST /jobs`, `GET /jobs/{id}` and `DELETE /jobs/{id}` all require the bearer token. A request carries validated coordinates, parameter, historical monthly range, horizon (1–24), interval level (0.8/0.9/0.95), model, parsed raw NASA monthly observations and provenance. Replies return explicit queued/running/completed/failed/cancelled status, stages and result/error. Opaque unpredictable job IDs are safe to display; the token remains server-only. At most eight active jobs, one training task at a time, 32 cached jobs, one-hour terminal cache TTL. Requests deduplicate on the full data snapshot, provenance, settings and feature version. Cancellation is cooperative at evaluation-block boundaries; ongoing sklearn fit finishes before a cancellation check. Protect public app submission further at the host if required by your traffic/budget; do not expose the Python service without its token. No automatic retry loops.

Local development/testing:

```sh
python -m venv .venv
.venv/bin/pip install -r requirements.txt pytest==8.3.5 httpx==0.28.1
.venv/bin/python -m pytest services/forecast/test_engine.py -q
# From this service directory, with environment configured:
.venv/bin/uvicorn app:app --host 0.0.0.0 --port 8000 --workers 1
```

## Scientific policy v1

Reuse the app's validated NASA parser. Python validates rows again, reindexes an explicit calendar, drops invalid/sentinel rows and incomplete current/future months, and retains only the latest contiguous segment ending on or before the requested end. Never interpolate. Rainfall is raw monthly mean daily rate times actual calendar days (leap years included); all other targets are monthly means. Request metadata retains NASA header/version fields when supplied, source units, coordinates, returned geometry and UTC retrieval time. Location text derived from Google is replaced by selected-point text before entering this API or any export.

Features: observed lags 0,1,2,5,11; trailing means/population standard deviations over 3,6,12; target-calendar-month sine/cosine; origin index since retained-segment start. Each direct model lead h is trained only on origins 11..cutoff−h. Its label and every predictor are observable by cutoff. Fixed GradientBoostingRegressor configuration: 40 trees, learning rate .05, depth 2, minimum leaf samples 5, squared error, seed 42. No full-history scaling, random shuffling or future covariates. Latitude/longitude selects data, not transfer learning. Seasonal benchmark repeats the last observed seasonal cycle for all leads, including beyond 12.

For horizon H, use three **disjoint target-month blocks**, each L=24+H−1 months. Each block has 24 consecutive forecast origins (spacing one month), from block-start−1 through block-start+22. Every lead 1..H has exactly 24 errors inside that block. Adjacent origin sets are separated by H months (H−1 omitted origins), preventing target labels crossing blocks. Every fold refits from expanding observed history, with a minimum 36 observable lead-specific labels. Minimum retained months is max(120, 47+H+3L): H=1 needs 120, H=3 needs 128, H=12 needs 164, H=24 needs 212. Returned block and per-lead dates/counts document exact cutoffs for each request. Earlier test outcomes may enter later test folds' observed training, as in real rolling-origin deployment, but never model selection or interval calibration. Origins overlap and are dependent, not independent experiments.

Auto selects validation pooled MAE across equal per-lead counts; baseline wins exact ties. Configuration is frozen before calibration/testing. Explicit model choices stay selected even with negative skill. Both models are evaluated on validation; selected model and baseline share identical final test targets. Calibration uses frozen model-selection/configuration and expanding refits, with q_h equal to kth sorted absolute calibration error, k=ceil((n_h+1)c). Unsupported k>n_h is rejected. Test intervals use fixed q_h, never test residuals. Final point models refit on all eligible observations while historical metrics remain unchanged. Temperature unbounded; rainfall/wind predictions and bounds >=0; humidity [0,100]; identical postprocessing throughout; clipping counts disclosed. Model age/cutoff is explicit: horizon starts after the last eligible observation, not today. A/B requests block when last eligible observations differ; revise to a common cutoff.

MAE/RMSE in original units, baseline MAE on identical targets, skill=100*(1−MAE/baselineMAE). MASE averages each test error divided by its own training fold's mean absolute 12-month seasonal difference. Any zero MASE denominator makes aggregate MASE unavailable; zero baseline MAE makes skill unavailable. Coverage is count inside inclusive bounds/total count; width mean upper−lower. Overall metrics pool all leads, not independent experiments. Metrics and exports retain full precision; missing numerics are null.

These are empirical, conformal-style future-value intervals, not historical Sen-slope confidence intervals, Mann–Kendall p-values, distribution-free time-series guarantees or weather/flood warnings. Refit drift, dependence, climate shifts and weak long-horizon tree extrapolation limit their validity. No joint annual uncertainty or incompatible-unit combined axes.

## Verification status

See the app's roadmap and final implementation report for executed tests/live NASA checks. Local Python tests do not establish that a separate host is deployed. Until an HTTPS service URL and credential are configured, published forecasting is unavailable and historical analysis remains functional.
