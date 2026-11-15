# Methodology

**Project:** Earth System Trend Detective — UTHMSPACE  
**Snapshot:** 15 November 2026; source commit `ad78f8b4f658b9468fae97b4c0e8b337e6ac7687`  
**Related files:** [README](README.md), [data sources](nasa-data-sources.md), [forecasting](machine-learning.md), [literature](literature-review.md)

## 1. Investigation design

The core question is whether a selected environmental variable changes consistently over a specified period, and whether a second location shows a different descriptive pattern. Each result belongs to a particular variable, geographic support, time period and processing method. Monthly history, annual trends, global screening and short-term forecasts answer different questions and retain separate labels.

The historical point-analysis workflow is:

1. Select a parameter, coordinates and period.
2. Retrieve NASA POWER monthly records through a fixed-endpoint server proxy.
3. Parse valid calendar months, preserve missing observations and normalize verified units.
4. Construct annual values only from complete years.
5. Calculate OLS regression, Kendall trend evidence and Sen’s slope with its interval.
6. For A/B comparison, intersect complete years and recalculate both locations over that same intersection.
7. Export the submitted data and settings with provenance.

## 2. Data quality and annual aggregation

Only valid monthly date keys are accepted. Missing, nonfinite and sentinel values are excluded from calculations; genuine zeros are retained. Missing observations are not filled by interpolation. An annual point result requires all 12 valid months, and a historical trend requires at least eight complete years. This minimum is an application rule, not proof of adequate statistical power.

Let $x_{y,m}$ be a monthly mean and $d_{y,m}$ its actual number of calendar days. Leap years are included.

For temperature, relative humidity, wind speed and mean daily solar energy:

$$
\bar{x}_y=\frac{\sum_{m=1}^{12}d_{y,m}x_{y,m}}{\sum_{m=1}^{12}d_{y,m}}.
$$

For POWER precipitation supplied as a monthly mean daily rate $r_{y,m}$ in mm/day:

$$
P_{y,m}=r_{y,m}d_{y,m},\qquad P_y=\sum_{m=1}^{12}P_{y,m}.
$$

For an IMERG monthly mean rate in mm/hour, monthly depth is $P_{y,m}=r_{y,m}\times24d_{y,m}$. A file already containing accumulated depth is not multiplied by duration again.

Solar point data use a canonical kWh/m²/day target after checking the response metadata. Documented Wh and MJ energy units can be converted. Ambiguous point-response flux units are rejected. The separately prepared spatial radiation workflow has an explicitly documented mean-flux conversion; that verified conversion must not be generalized to an unknown point response.

## 3. Ordinary least squares linear regression

For actual calendar years $t_i$ and annual values $y_i$, fit:

$$
\hat y_i=a+bt_i,\qquad
b=\frac{\sum_i(t_i-\bar t)(y_i-\bar y)}{\sum_i(t_i-\bar t)^2},\qquad
a=\bar y-b\bar t.
$$

The slope is in variable units per year. Multiplication by ten gives a per-decade rate. The app also reports $R^2$, calculated from the squared Pearson correlation for this simple intercept model.

A positive slope describes an increasing fitted trend; a negative slope describes a decreasing trend. $R^2$ describes fit to the historical values. It is not forecast accuracy, a confidence percentage or evidence of a causal mechanism. The current implementation does not attach a separate OLS slope p-value to this result.

## 4. Kendall / Mann–Kendall trend evidence

For time-ordered observations, the pairwise sign statistic is:

$$
S=\sum_{i<j}\operatorname{sign}(y_j-y_i).
$$

The implementation uses a TypeScript port of SciPy’s **Kendall tau-b test between calendar year and annual value**, with a two-sided p-value and automatic exact/asymptotic selection. It is related to the Mann–Kendall approach to monotonic trends. It should be described precisely as implemented rather than implying that a seasonal or autocorrelation-adjusted Mann–Kendall procedure is present.

Tau-b normalizes concordant minus discordant pairs while accounting for ties. Its sign indicates direction and its magnitude describes rank association. The null concerns no monotonic association under the test assumptions. The app uses $\alpha=0.05$: a smaller p-value is labelled significant under those assumptions. A larger p-value does not prove that a trend is absent.

The current exact branch applies to untied data with at most 33 observations or an extreme pair ordering. Other cases use a tie-adjusted normal approximation. Nearly constant series are rejected before analysis.

Annual residual lag-one correlation is available as a diagnostic. It does **not** correct the p-value. Serial dependence, changing variance, selected periods and repeated testing can affect inference. There is no implemented seasonal Kendall test, Hamed–Rao adjustment or global false-discovery correction in the reviewed point workflow.

References: Mann [M1], SciPy [M2], Hamed and Rao [M4].

## 5. Sen’s slope and confidence interval

Compute all slopes between observations at distinct calendar years:

$$
q_{ij}=\frac{y_j-y_i}{t_j-t_i},\qquad j>i.
$$

Sen’s estimate is the median of these pairwise slopes. Actual year differences are used, so omitted incomplete years do not become artificially adjacent. The 95% slope interval uses ordered pairwise slopes and tie-adjusted rank variance, following the project’s SciPy parity implementation.

This estimator reduces sensitivity to individual extreme values compared with OLS. It still depends on the data period, support and assumptions. A slope interval is uncertainty about a historical trend rate; it is different from a future-value prediction interval. Dependence can also undermine the nominal interval interpretation.

The app retains both OLS and Sen estimates. Their disagreement is a reason to inspect the series for outliers, nonlinear change or a change in regime, rather than automatically selecting the more dramatic number. References: Sen [M3] and SciPy [M2].

## 6. Two-location comparison

The app takes the intersection of complete calendar years and requires at least eight common years. Both locations’ statistics are recomputed after alignment. Individual-location exports can retain all valid months and complete years, while the comparison export identifies the common period.

The difference between two slopes is descriptive. One location having p < 0.05 while the other has p ≥ 0.05 is not a formal test that their trends differ. A formal comparison would require an appropriate joint or resampling method that addresses dependence and uncertainty.

## 7. Worldwide maps and hotspot screening

These are distinct calculations:

| Product | Method | Completeness and interpretation |
| --- | --- | --- |
| Prepared spatial period mean | Mean of 20 canonical annual source values, equal weight per year | Fixed 2005–2024 product; requires all 20 finite annual values |
| Prepared spatial trend | Median pairwise slope against actual years, multiplied by ten | Sen slope per decade; no gridwise significance inference |
| Hotspot screening | OLS slopes per decade, area-weighted relative thresholds | Selectable periods within 2005–2024; at least 15 years, at least 90% valid, and valid endpoints |

Hotspots use one jointly eligible temperature/rainfall population. Warming candidates must have positive temperature slopes above the selected area-weighted percentile; drying candidates must have negative rainfall slopes below the corresponding lower percentile. The 5%, 10% or 20% setting is a relative area threshold. Ties and sign requirements mean the selected cell count need not equal that percentage.

Cell weights use spherical area:

$$
A=R^2|\Delta\lambda|\,|\sin\phi_N-\sin\phi_S|,
$$

where angles are in radians. Four-edge connectivity groups candidate cells, wraps longitude and does not bridge missing gaps. The installed mask includes eligible ocean cells. Results depend on the study rectangle and population. They are candidate patterns, not validated danger zones, significance clusters or future forecasts.

## 8. Rainfall monthly CCDF

For valid monthly depths $P_1,\ldots,P_N$, the empirical strict exceedance is:

$$
\widehat{\Pr}(P>x)=\frac{\#\{i:P_i>x\}}{N}.
$$

Equal values are grouped, and the tail at the sample maximum is zero. Selecting a calendar month changes the denominator to the valid observations for that month. Comparisons use valid common months after geographic checks.

In the recorded 240-month IMERG sample, one month exceeds 500 mm: $100/240=0.4167\%$. The January subset has 20 values and zero exceedances above that threshold. These are empirical monthly-depth frequencies. They do not give annual one-minute rain-rate exceedance, $R_{0.01}$, flood probability or communication-link availability.

## 9. Rain attenuation and short-interval research

The rain-attenuation module uses separate ITU-R inputs and models:

| Reference | Role |
| --- | --- |
| P.837-8 | Rain climatology and $R_{0.01}$ |
| P.839-4 | Zero-degree height and rain-height model |
| P.838-3 | Specific attenuation coefficients, $\gamma_R=kR^\alpha$ |
| P.618-14 | Earth–space rain attenuation |
| P.530-19 | Terrestrial reference-link rain attenuation |

Scientific source files are checked by hash, structure and numeric constraints. Source-grid lookups and scenario geometry feed the model; calculated nodes produce contours and point/curve exports. Contour interpolation provides a display surface, not additional source resolution. Unsupported or invalid cases remain masked.

Results are long-term rain-only scenario estimates. Actual terrestrial endpoints, terrain, obstructions, multipath and a full availability budget are not represented. The known terrestrial displayed/exported inclination issue described in the README remains relevant.

A separate experimental short-interval workflow trains empirical quantile transfer on the earliest 70% of complete paired windows and tests on later windows. Real half-hourly IMERG and fine-interval gauge validation files have not been supplied. It does not reconstruct measured minutes or supply accepted ITU conversion inputs.

## 10. Fisheries, air quality and PV

**Fisheries:** Real January 2024 Aqua MODIS SST and chlorophyll-a remain separate numerical layers. CF packing/fill and source-specific quality rules are applied. A fixed ocean mask and spherical area weights produce 1° overviews, with at least 70% valid eligible coverage. Native samples retain nominal 9 km support. Artificial fish symbols are kept outside scientific arrays and exports. One month cannot establish a temporal trend or train a fish forecast.

**Air quality:** The Python adapter reads a consistent NASA GEOS-CF snapshot. A PM2.5 index needs exactly 24 unique contiguous valid one-hour intervals. Versioned EPA breakpoints, concentration truncation and index rounding produce a PM2.5-only estimate. It is a NASA model-derived index, not station observation, full multi-pollutant AQI, NowCast or Malaysia’s official API/IPU. Initialization metadata can be unavailable and is kept null.

**PV:** For monthly horizontal irradiation $H_m$, rated capacity $P_r$, reference irradiance $G_{ref}=1\;\mathrm{kW/m^2}$, and assumed performance ratio $PR$:

$$
E_m=P_r\frac{H_m}{G_{ref}}PR.
$$

Daily mean solar energy is multiplied by actual month duration to obtain $H_m$. Annual yield requires 12 complete months. Capacity and PR are assumptions; tilt, shading, detailed temperature effects and measured-system validation are not modelled separately.

## 11. Reproducibility and verification

Retain source/product version, coordinates or bounds, units, date range, retrieval/preparation time, masks, hashes, aggregation, model settings and missing-data rules. Submitted snapshots prevent a changed control from silently relabelling old results. Keep unavailable numeric results as null.

The source contains SciPy parity fixtures and checks for calendar duration, common-year alignment, units, CCDFs, source integrity and engineering calculations. Existing work records contain passing checks and browser demonstrations; the complete repository suite was not rerun for this documentation task. Numerical parity verifies an implementation against references, while ground validation is a separate scientific requirement.

## References

- **[M1]** Mann, H. B. (1945). Nonparametric Tests Against Trend. *Econometrica*, 13(3), 245–259. [doi:10.2307/1907187](https://doi.org/10.2307/1907187).
- **[M2]** SciPy documentation: [Kendall tau](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.kendalltau.html) and [Theil–Sen slopes](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.theilslopes.html). These describe the reference algorithms; the app uses its own TypeScript ports.
- **[M3]** Sen, P. K. (1968). Estimates of the Regression Coefficient Based on Kendall’s Tau. *JASA*, 63(324), 1379–1389. [doi:10.1080/01621459.1968.10480934](https://doi.org/10.1080/01621459.1968.10480934).
- **[M4]** Hamed, K. H., & Rao, A. R. (1998). A modified Mann-Kendall trend test for autocorrelated data. *Journal of Hydrology*, 204(1–4), 182–196. [doi:10.1016/S0022-1694(97)00125-X](https://doi.org/10.1016/S0022-1694(97)00125-X).
- Official dataset/API and ITU-R links are provided in [nasa-data-sources.md](nasa-data-sources.md); forecasting references are in [machine-learning.md](machine-learning.md).
