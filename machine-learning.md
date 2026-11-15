# Machine Learning and Forecast Evaluation

**Project:** Earth System Trend Detective — UTHMSPACE  
**Snapshot:** 15 November 2026; source commit `ad78f8b4f658b9468fae97b4c0e8b337e6ac7687`  
**Engine version:** `direct-monthly-v2-solar`  
**Related files:** [README](README.md), [methodology](methodology.md), [data sources](nasa-data-sources.md)

## 1. Forecasting task

The forecasting module predicts monthly environmental values for a selected NASA POWER location. It compares gradient-boosted regression with a seasonal naive benchmark and reports performance on historical forecasts made using only information available at each forecast origin.

This is a statistical forecasting demonstration. Its target is the selected NASA product, not independently measured station weather. It is separate from the historical trend line, NASA GEOS-CF’s atmospheric forecasts, the ITU propagation scenarios and the artificial fish illustration.

| Parameter | Forecast target | Output constraints |
| --- | --- | --- |
| `T2M` | Monthly mean air temperature, °C | Unbounded by the engine |
| `PRECTOTCORR` | Monthly accumulated precipitation, mm | Nonnegative |
| `RH2M` | Monthly mean relative humidity, % | 0–100 |
| `WS10M` | Monthly mean wind speed, m/s | Nonnegative |
| `ALLSKY_SFC_SW_DWN` | Monthly mean daily solar energy, kWh/m²/day | Nonnegative; optional monthly energy totals multiply by target-month days |

Forecast horizons are 1–24 months. The horizon begins after the last retained complete observation. A December 2024 cutoff produces forecasts beginning in January 2025, regardless of the date on which the user runs the app. A/B requests require a common latest eligible observation so that prediction dates align.

## 2. Data preparation

The browser submits an immutable monthly data snapshot through the app’s server proxy. Python validates the rows again, constructs an explicit monthly calendar and excludes invalid/sentinel values and incomplete current/future months. It retains the latest contiguous segment ending within the requested period. It does not interpolate across missing months or silently join separated segments.

POWER rainfall is converted from monthly mean mm/day to monthly depth using actual calendar days. Solar arrives in the already verified canonical unit and is not converted a second time. The response identifies retained dates, discarded earlier data and missing months.

Latitude and longitude select the source series. The reviewed model does not learn a shared global spatial model or transfer information across locations. Each parameter/location combination is fitted independently.

## 3. Implemented models

### 3.1 Seasonal naive benchmark

The benchmark predicts the most recently observed value for the target calendar month. It repeats the last observed annual cycle for horizons beyond 12 months. This is a useful reference because the environmental series can be strongly seasonal.

Seasonal naive is not machine learning in this implementation. If it performs better on validation, Auto mode can select it and reports that model honestly.

### 3.2 Direct gradient-boosted regression

A separate `GradientBoostingRegressor` predicts each lead $h$. For example, lead 3 directly predicts three months after the origin; it does not require feeding lead-1 and lead-2 predictions back into the model.

| Setting | Reviewed value |
| --- | --- |
| Number of trees | 40 |
| Learning rate | 0.05 |
| Maximum tree depth | 2 |
| Minimum leaf samples | 5 |
| Loss | Squared error |
| Random seed | 42 |
| Minimum observable labels for each lead-specific fit | 36 |

At origin $t$, the features are:

- Observed target lags 0, 1, 2, 5 and 11 months, where lag 0 is the latest value available at the origin.
- Trailing means and population standard deviations over 3, 6 and 12 months, ending at the origin.
- Sine and cosine of the target calendar month.
- Origin index since the retained segment began.

All value-dependent features end at the origin. Calendar features are known in advance. There is no random time-series shuffling, full-history scaling or future observed covariate. Trees can capture seasonal and nonlinear relationships but offer limited extrapolation beyond patterns represented in training.

## 4. Chronological evaluation

The engine uses expanding-origin refits and three **disjoint target-month blocks**:

| Block | Purpose | Decisions allowed |
| --- | --- | --- |
| Validation | Compare tree model and benchmark | Select the model in Auto mode |
| Calibration | Estimate lead-specific error quantiles | Set interval widths after model choice is frozen |
| Test | Estimate performance on later targets | Report accuracy, baseline skill and interval coverage |

For horizon $H$, each block spans $L=24+H-1$ target months and supplies 24 forecast errors per lead. Adjacent origin sets are separated so target labels do not cross block boundaries. The minimum retained history is:

$$
N_{min}=\max(120,\;47+H+3(24+H-1)).
$$

| Horizon | Minimum contiguous months |
| --- | --- |
| 1 month | 120 |
| 3 months | 128 |
| 12 months | 164 |
| 24 months | 212 |

Auto selects the lowest pooled validation MAE; the benchmark wins exact ties. Explicit model choices remain selected even if later skill is negative. Model choice is frozen before calibration and testing.

At every origin, training uses only labels observable at that time. Earlier test outcomes may become observed history for later test-origin refits, as they would during rolling operation. They never change model selection or calibration. Forecast origins and overlapping horizons are dependent; 72 forecast errors do not mean 72 independent experiments or necessarily 72 distinct target months.

Final prediction models refit on all eligible historical data. That refit does not replace or improve the recorded historical test metrics. General motivation for chronological evaluation and seasonal benchmarks is given by Hyndman and Athanasopoulos [F2].

## 5. Accuracy metrics

Let $e_i=y_i-\hat y_i$, using the same test targets for the selected model and benchmark.

$$
MAE=\frac{1}{N}\sum_i|e_i|,\qquad
RMSE=\sqrt{\frac{1}{N}\sum_i e_i^2}.
$$

$$
Skill(\%)=100\left(1-\frac{MAE_{selected}}{MAE_{seasonal\ naive}}\right).
$$

MAE describes average absolute error in the target’s units; RMSE gives larger errors more weight. Positive skill means lower MAE than the benchmark on the same test targets. Negative skill means worse performance. A zero baseline MAE makes this ratio unavailable.

MASE scales each absolute test error by that origin’s training-only mean absolute 12-month seasonal difference. If any required scaling denominator is zero, the aggregate MASE is unavailable. Metrics are shown per lead and pooled across leads. Pooled values should not hide weaker performance at longer horizons or combine incompatible units across variables.

## 6. Prediction intervals

For each lead $h$, collect absolute calibration errors $r_{h,1},\ldots,r_{h,n_h}$. At nominal coverage $c$, choose the ordered error at:

$$
k=\lceil(n_h+1)c\rceil,\qquad q_h=r_{h,(k)}.
$$

Unsupported ranks greater than the calibration sample size are rejected. Prediction bounds are the forecast plus/minus $q_h$, with the same physical clipping rules used throughout validation, calibration, testing and final output.

The app supports nominal 80%, 90% and 95% levels. With 24 calibration errors per lead, the 95% rule selects the largest calibration absolute error; interval estimation is consequently sensitive to a small calibration sample.

Report both historical test coverage and mean width:

$$
Coverage=\frac{\#\{i:L_i\le y_i\le U_i\}}{N},\qquad
Width=\frac{1}{N}\sum_i(U_i-L_i).
$$

These are empirical, conformal-style intervals. Temporal dependence, distribution shift and refitting prevent a claim of guaranteed distribution-free future coverage. A nominal 95% interval is not demonstrated 95% local accuracy. These intervals also differ from Sen-slope confidence intervals and trend-test p-values. The implementation does not provide joint annual uncertainty by adding monthly bounds.

## 7. Recorded forecast demonstration

The latest project review records this Johor temperature example:

| Item | Recorded value |
| --- | --- |
| Historical selection | January 2000–December 2024 |
| Final cutoff | December 2024 |
| Prediction months | January–March 2025 |
| Selected model | Gradient-boosted trees |
| Test forecast errors | 72 |
| Test MAE | 0.521 °C |
| Seasonal naive MAE | 0.567 °C |
| Reported skill | 8.1% |
| Nominal interval level | 95% |
| Historical interval coverage | 83.3% |

These are recorded demonstration values, not a new experiment run while writing this file. The rounded MAEs approximately reproduce the reported skill. The lower-than-nominal coverage is a material limitation and should remain visible when presenting the result. The prediction dates are retrospective relative to November 2026.

## 8. Service and reproducibility

The application’s JavaScript runtime does not execute the Python training engine. A separately hosted FastAPI service performs the work. App server functions proxy its fixed configured HTTPS address and keep the shared service token server-only.

Source documentation pins Python 3.13.5, scikit-learn 1.7.2 and NumPy 2.2.6. Jobs are bounded and held in memory on a single instance. Service sleep/restart can discard jobs; the UI reports expiry or loss and requires a new submission. It should not silently replace an unavailable forecast with a trend extrapolation or fabricated metrics.

Key source files are `services/forecast/engine.py`, `app.py`, `requirements.txt`, `test_engine.py`, and the frontend’s `src/lib/forecast/` and forecast components. Retain the engine/dependency versions, source snapshot, cutoff, feature configuration, model choice, block dates/counts, metrics, interval level, clipping counts and warnings in each reproducible result.

The same hosted service supports a separate GEOS-CF data adapter. GEOS-CF forecasts are produced by NASA’s model, not trained by this gradient-boosting engine. Fish symbols and ITU attenuation are also outside this ML model.

## 9. Remaining research

Priority work includes independent station/gauge validation, sensitivity to historical periods, more stable interval assessment, performance across climates and seasons, and tests for distribution shift. Additional models such as ARIMA, ETS or neural networks would need the same chronological comparison before any improvement could be claimed. They are not implemented forecast models in this reviewed engine.

## References

- **[F1]** Friedman, J. H. (2001). Greedy function approximation: A gradient boosting machine. *The Annals of Statistics*, 29(5), 1189–1232. [doi:10.1214/aos/1013203451](https://doi.org/10.1214/aos/1013203451). Methodological foundation; not validation of this project’s forecast.
- **[F2]** Hyndman, R. J., & Athanasopoulos, G. *Forecasting: Principles and Practice*, 3rd ed., OTexts. [The forecaster’s toolbox](https://otexts.com/fpp3/toolbox.html), including seasonal benchmarks, forecast errors and time-series cross-validation.
- **[F3]** scikit-learn, [`GradientBoostingRegressor`](https://scikit-learn.org/1.7/modules/generated/sklearn.ensemble.GradientBoostingRegressor.html). Version-specific estimator reference; project configuration is taken from the inspected engine.
