# Literature Review and Existing Systems

**Project:** Earth System Trend Detective — UTHMSPACE  
**Snapshot:** 15 November 2026; source commit `ad78f8b4f658b9468fae97b4c0e8b337e6ac7687`  
**Related files:** [README](README.md), [methodology](methodology.md), [data sources](nasa-data-sources.md), [machine learning](machine-learning.md)

## 1. Scope

This is a focused narrative review of the methods, data systems and application references relevant to the prototype. It is not a systematic review, exhaustive competitor survey or evidence that every method is valid for every location. Research findings motivate design choices; implementation status comes from the inspected source and current project records.

The project addresses a practical question: how can a learner move from a location-based environmental question to a defensible trend estimate, a regional comparison and an application scenario while retaining the evidence and its limitations?

## 2. Trend detection and estimation

### Mann (1945): nonparametric trend testing

Mann’s foundational paper provides a rank/sign-based basis for testing trend [R1]. It motivates an approach that does not require environmental values themselves to follow a normal distribution. The project uses a Kendall tau-b test against calendar year as its preliminary monotonic-trend evidence.

The implementation should be described precisely: it is a SciPy-style exact/asymptotic Kendall calculation, not an implemented seasonal or serial-correlation-adjusted Mann–Kendall test. A p-value measures evidence under assumptions; it does not measure change magnitude or identify its cause.

### Sen (1968): estimating the rate of change

Sen’s estimator uses the median of pairwise slopes [R2]. It complements a trend test by reporting an interpretable rate and a slope interval. The project applies this method to actual calendar years and displays it alongside OLS.

The design implication is to show direction, magnitude and uncertainty together. A positive estimate with an interval crossing zero should not be presented as equally strong evidence as an estimate with a clearly positive interval. Robustness to individual extremes does not remove temporal dependence, data quality or period-selection concerns.

### Hamed and Rao (1998): dependence matters

Hamed and Rao examine how autocorrelation affects Mann–Kendall inference and propose a variance modification [R3]. This supports a major limitation in the current project: annual observations can remain dependent even after seasonal aggregation.

The app reports a residual correlation diagnostic but does not implement the paper’s correction. A stronger research version should assess dependence and select a justified correction or resampling procedure before making confirmatory significance claims. Showing a diagnostic is not equivalent to correcting the test.

### Implications for spatial interpretation

Point testing and global screening require different claims. The prepared global trend layer maps Sen slopes, while Hotspots ranks OLS slopes relative to an eligible area. It does not apply a spatial significance test or a multiple-testing correction. Connected candidate areas should therefore be described as exploratory patterns, not statistically verified hazard clusters.

## 3. Forecasting and evaluation

### Friedman (2001): gradient boosting

Friedman develops gradient boosting as stagewise function approximation [R4]. This provides the methodological foundation for the app’s direct lead-specific regression trees. The project’s shallow, fixed configuration aims to keep the demonstration bounded and reproducible.

The foundational paper does not show that gradient boosting is the best model for these NASA series. That requires comparison on the project’s own data. The app consequently compares against a seasonal naive forecast and permits that benchmark to win.

### Hyndman and Athanasopoulos: forecasting practice

The authors’ forecasting text explains seasonal benchmarks, chronological forecast evaluation and accuracy measures [R5]. These principles motivate the project’s expanding forecast origins and disjoint validation, calibration and test targets.

The project’s exact blocking policy is an implementation choice, not a copied result or universal prescription. Overlapping forecast horizons yield dependent errors. Its empirical prediction intervals require measured coverage; the nominal label alone is insufficient.

The recorded temperature demonstration improved MAE over its benchmark but achieved 83.3% test coverage for nominal 95% intervals. This is useful evidence of a working model and an unresolved uncertainty problem, not evidence of operational forecast reliability.

## 4. NASA data and existing exploration systems

Official NASA systems already provide substantial discovery, visualization and analysis. Earth System Trend Detective uses those resources and adds a guided cross-module workflow. It should be positioned as a complementary educational application rather than claiming NASA lacked maps, downloads or time-series tools.

| Existing system | Established role | How this project relates |
| --- | --- | --- |
| NASA POWER API and Data Access Viewer [R6] | Access to solar and meteorological products | Uses POWER for selected-location histories, A/B comparisons and solar scenarios |
| NASA Giovanni [R7] | Online visualization and analysis, including regional time series | Uses a genuine Giovanni IMERG export and retains its reproduction information |
| NASA Worldview [R8] | Interactive satellite imagery, layer/date comparisons and data access | Adds the project’s numerical trend workflow and application scenarios; does not replace Worldview |
| Earthdata Search / CMR [R9] | Product and granule discovery with metadata | Supports source verification and preparation; catalogue hits are not numeric ingestion |
| NASA GEOS-CF tools [R10] | Atmospheric-composition model access and visualization | Reads NASA model PM2.5 and presents dated PM2.5-only index estimates |

This comparison describes documented roles. It is not a claim that the project outperforms these services, nor a feature-by-feature benchmark of their current interfaces.

## 5. Rainfall and propagation references

NASA IMERG documentation distinguishes precipitation products, rates, accumulations and monthly gauge adjustment [R11]. The project’s rainfall module reflects that distinction by keeping POWER and IMERG separately identified and converting rates using the actual duration.

Monthly precipitation depth is appropriate for climatology and monthly empirical exceedance. It cannot directly establish minute-scale extremes. A monthly CCDF therefore cannot be used as a substitute for one-minute $R_{0.01}$ or link availability.

The engineering extension uses ITU-R P.837-8, P.839-4, P.838-3, P.618-14 and P.530-19 [R12]. These provide a separate climatology/model chain for long-term rain attenuation. The project’s contribution is an inspectable scenario interface, contour display and export workflow. Numerical reference agreement is distinct from field validation of an actual communication link.

The experimental short-interval distribution-conversion workflow still lacks real paired validation files. Synthetic UI checks do not validate its extremes or justify feeding its estimates into ITU calculations.

## 6. Ocean and fisheries interpretation

The installed NASA MODIS Aqua products provide SST and chlorophyll-a environmental context [R9]. The application preserves them as separate real layers with separate units and processing versions. It currently contains one month, January 2024.

A scientific fish-location or catch model would require a defined response variable, target species, fish observations and independent temporal/spatial validation. None is supplied in the reviewed demonstration. The schematic icons are therefore expressly labelled artificial and do not constitute an ecological result.

Future work could investigate multi-year environmental covariates and species-specific habitat relationships. That is a research direction, not an implemented or literature-validated fish prediction feature.

## 7. Atmospheric modelling and air-quality interpretation

Keller et al. describe and evaluate GEOS-CF v1.0 [R13]. The paper provides background on the modelling system; it does not independently validate the project’s selected-point adapter or establish local PM2.5 accuracy. The implemented adapter uses v2 output, so current NASA v2 documentation is also needed [R10].

The app converts complete modelled PM2.5 windows to a PM2.5-only index estimate. It does not reproduce a monitoring network or Malaysia’s official multi-pollutant API/IPU. Independent station comparison, model bias and uncertainty assessment remain necessary before stronger local claims.

## 8. Project contribution and research gaps

The project’s defensible contribution is the combination of a local-to-global investigation sequence, traceable NASA products, understandable statistics, visible limitations and downloadable evidence. Practical demonstrations connect the analysis to energy, rainfall, atmospheric conditions, ocean context and communication engineering.

| Current evidence | Remaining gap | Appropriate next investigation |
| --- | --- | --- |
| Working trend calculations and SciPy reference fixtures | Serial dependence and confirmatory inference | Assess corrected tests/resampling and sensitivity to periods |
| Global slope maps and relative hotspot candidates | Statistical field inference and hazard meaning | Define the research question before adding multiple-testing or risk methods |
| Working forecast and seasonal benchmark comparison | Interval undercoverage and external validity | Evaluate multiple climates, seasons, cutoffs and independent observations |
| Real monthly IMERG sample | Fine-time rainfall validation | Collect aligned half-hourly and gauge records with documented support |
| Real SST/chlorophyll layers | Only one month and no fish response data | Add multi-year source data; collect species-specific observations before modelling |
| GEOS-CF adapter | Local PM2.5 validation and missing initialization metadata | Compare against compatible station series and improve run identification |
| PV scenario | Measured-system validation | Compare with plant generation while documenting tilt, shading and losses |
| Functioning interface and exports | Measured educational/community impact | Test learner interpretation, task success and decision quality |

No measured adoption, improved decisions, environmental benefit or economic saving is claimed. Those require user studies or deployment evidence beyond a functioning prototype.

## References

- **[R1]** Mann, H. B. (1945). Nonparametric Tests Against Trend. *Econometrica*, 13(3), 245–259. [doi:10.2307/1907187](https://doi.org/10.2307/1907187).
- **[R2]** Sen, P. K. (1968). Estimates of the Regression Coefficient Based on Kendall’s Tau. *Journal of the American Statistical Association*, 63(324), 1379–1389. [doi:10.1080/01621459.1968.10480934](https://doi.org/10.1080/01621459.1968.10480934). Algorithm interpretation is also documented in [SciPy’s official reference](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.theilslopes.html).
- **[R3]** Hamed, K. H., & Rao, A. R. (1998). A modified Mann-Kendall trend test for autocorrelated data. *Journal of Hydrology*, 204(1–4), 182–196. [doi:10.1016/S0022-1694(97)00125-X](https://doi.org/10.1016/S0022-1694(97)00125-X).
- **[R4]** Friedman, J. H. (2001). Greedy function approximation: A gradient boosting machine. *The Annals of Statistics*, 29(5), 1189–1232. [doi:10.1214/aos/1013203451](https://doi.org/10.1214/aos/1013203451).
- **[R5]** Hyndman, R. J., & Athanasopoulos, G. *Forecasting: Principles and Practice*, 3rd ed. OTexts. [Forecasting toolbox](https://otexts.com/fpp3/toolbox.html).
- **[R6]** NASA POWER. [Monthly API](https://power.larc.nasa.gov/docs/services/api/temporal/monthly/), [methodology](https://power.larc.nasa.gov/docs/methodology/) and [Data Access Viewer](https://power.larc.nasa.gov/data-access-viewer/).
- **[R7]** NASA GES DISC. [Giovanni](https://giovanni.gsfc.nasa.gov/giovanni/) and [cloud Giovanni beta](https://giovanni.earthdata.nasa.gov/).
- **[R8]** NASA ESDIS. [Worldview](https://worldview.earthdata.nasa.gov/) and [official Worldview overview booklet](https://earthdata.nasa.gov/s3fs-public/2025-03/worldview-booklet.pdf).
- **[R9]** NASA. [Earthdata Search](https://search.earthdata.nasa.gov/), [CMR API documentation](https://cmr.earthdata.nasa.gov/search/site/docs/search/api.html), [installed SST collection](https://search.earthdata.nasa.gov/search/granules?p=C1615905770-OB_DAAC) and [installed chlorophyll collection](https://search.earthdata.nasa.gov/search/granules?p=C3380709133-OB_CLOUD). Exact local product metadata are listed in `nasa-data-sources.md`.
- **[R10]** NASA GMAO. GEOS-CF [system description](https://gmao.gsfc.nasa.gov/gmao-products/geos-cf/system-description_geos-cf/), [data access](https://gmao.gsfc.nasa.gov/gmao-products/geos-cf/data-access_geos-cf/) and [FAQ](https://gmao.gsfc.nasa.gov/gmao-products/geos-cf/faq_geos-cf/).
- **[R11]** NASA GPM. [Data directory](https://gpm.nasa.gov/data/directory), [data FAQ](https://gpm.nasa.gov/data/faq) and monthly IMERG [doi:10.5067/GPM/IMERG/3B-MONTH/07](https://doi.org/10.5067/GPM/IMERG/3B-MONTH/07).
- **[R12]** ITU-R. [P.837-8](https://www.itu.int/rec/R-REC-P.837-8-202509-I/en), [P.839-4](https://www.itu.int/rec/R-REC-P.839-4-201309-I/en), [P.838-3](https://www.itu.int/rec/R-REC-P.838-3-200503-I/en), [P.618-14](https://www.itu.int/rec/R-REC-P.618-14-202308-I/en) and [P.530-19](https://www.itu.int/rec/R-REC-P.530-19-202509-I/en). These are the revisions used by the project.
- **[R13]** Keller, C. A., et al. (2021). Description of the NASA GEOS Composition Forecast Modeling System GEOS-CF v1.0. *Journal of Advances in Modeling Earth Systems*, 13, e2020MS002413. [doi:10.1029/2020MS002413](https://doi.org/10.1029/2020MS002413). Listed in NASA’s [recommended GEOS-CF citations](https://gmao.gsfc.nasa.gov/gmao-products/geos-cf/citing-geos-cf-data_geos-cf/).

Publisher metadata and official technical documentation were checked where accessible. The publisher page for Sen’s original paper did not provide accessible full text during this preparation; the method description is grounded in the inspected implementation and SciPy documentation rather than a claimed full-text reading.
