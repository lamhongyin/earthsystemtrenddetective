# Giovanni / IMERG rainfall update — 14 November 2026

## Delivered
- Separate Rainfall sources investigation, preserving historical POWER PRECTOTCORR and all existing modules.
- Source/single/comparison modes; shared location A for native point support; geography-safe regional numeric imports.
- Bounded 2 MB Giovanni CSV review, metadata-prefixed/quoted/BOM/newline support, strict calendar-month dates, duplicate rejection, known fills and negative exclusion, explicit units, provenance SHA-256 and original-text retention for safe files.
- Canonical monthly accumulated depth in mm: mean mm/day × days; mean mm/hour × 24 × days; kg/m²/s × seconds; monthly accumulated mm unchanged.
- Paired monthly graphs, common-complete-year annual totals, paired seasonal climatology, POWER−IMERG differences, MAE/RMSE/mean difference/correlation and descriptive actual-year Theil–Sen slopes in mm/decade.
- Monthly/annual/agreement/climatology CSV and immutable settings/provenance JSON. Original safe CSV download preserves original bytes, rather than prepending another BOM.
- Boundaries/source footprints only; regional averages are never rendered as fictitious rainfall pixels. POWER footprint is explicitly a nominal MERRA-2 native-grid support, not a returned administrative polygon or gauge.

## NASA access evidence
- Official configured-variable endpoint returned HTTP 200 and lists `GPM_3IMERGM_07_precipitation` (also lists separate quality/error fields, which the importer rejects as rainfall).
- CMR collection `C2723754851-GES_DISC`: GPM IMERG Final Precipitation L3 1 month 0.1 degree × 0.1 degree V07, short name GPM_3IMERGM; catalogue starts January 1998.
- January 2024 granule `3B-MO.MS.MRG.3IMERG.20240101-S000000-E235959.01.V07B.HDF5`; CMR represented interval 2024-01-01 00:00 to 2024-01-31 23:59:59.999 UTC.
- Official NASA documentation identifies monthly precipitation as mm/hr; actual imported display-unit metadata takes precedence.
- Direct GES DISC numeric granule request redirects to Earthdata and returns HTTP 401 without authorization.
- Giovanni cloud quota endpoint returns HTTP 401: no authentication token. NASA's official April 2026 averaging-service tutorial requires Earthdata authentication, quota and Harmony. No project Earthdata credential exists.
- Public ESRI IMERG service returns token-required; public NASA early-run imagery is not Final monthly and was not substituted.

**Automatic IMERG numerical retrieval is not implemented/verified. A real Giovanni-derived Johor investigation is not installed or verified.** The missing requirement is a genuine monthly Giovanni CSV with original source/units/bounds/interval metadata, or owner-authorized Earthdata access followed by a verified bounded numerical adapter. The app's check action verifies catalogue availability only, never claims data retrieval.

## Real Johor POWER validation
- Live same-origin app function requested PRECTOTCORR, AG, location 1.4927°N 103.7414°E, 2005–2024.
- API v2.10.0, source MERRA2, original units `mm/day`, time convention LST.
- 240 valid months; 20 complete years.
- January 2024: 19.92 mm/day × 31 = **617.52 mm**.
- 2024: independent sum of 12 rates × actual month duration = **5164.56 mm**; app annual CSV matches.
- Independent SciPy `theilslopes` on actual years = **546.1357142857144 mm/decade**; app reports 546.14. This is descriptive, not a significance claim.

## Browser verification
- Live NASA catalogue check, real POWER single-source analysis, four downloads and stale-setting retention verified through app server functions.
- Missing IMERG request explicitly fails; existing result remains labelled POWER, never substituted as IMERG.
- Full importer→review→comparison→CSV/JSON read-back tested with explicitly **synthetic** temporary test files. No such files are shipped as reference studies.
- Synthetic numerical read-back: 240 paired months, mean POWER−IMERG 9.5 mm, slopes 240 and 120 mm/decade, original region setting retained.
- Regional imports cannot silently become a selected-point series.
- Existing Historical, Forecast, Air Quality, Spatial, Hotspots and PV tabs open. Their scientific tests pass; all historical/server flows were not rerun end-to-end.
- 390×844 phone and 1280×1800 desktop checked, no page overflow or browser runtime errors. Boundary map renders OpenStreetMap tiles. Existing Google selection map is intentionally unavailable on localhost.
- Harness reports build OK. Relevant tests include conversion, leap-year, no double multiplication, fills, duplicate/strict dates, complete years, actual-year positive/negative/zero trends, paired metrics, geography and secret-link rejection.

## Limitations and future research metadata
- No genuine IMERG monthly value/annual sum can be independently checked until numeric access or a real export is supplied; no claim of meaningful Giovanni dataset analysis or challenge eligibility is made yet.
- Regional comparison requires actual matching area-weighted POWER and IMERG numeric exports, identical rectangle/mask/boundary-cell method; no point-as-region substitution and no automatic regional POWER adapter.
- User-reviewed CSV metadata cannot authenticate the export's actual origin. Partial/midmonth timestamps are rejected rather than guessing represented intervals. Imports are held in the current page session; exports enable reproducibility, but no public cached case study exists.
- Monthly interval, quantity, original unit/conversion, source run/version, quality/missing flags, bounds/grid/mask/aggregation/coverage, hash and import date retained. Underlying integration time is not invented.
- Slopes are descriptive; no dependence-adjusted significance test, regridding, global IMERG raster, minute rainfall, P.837 conversion, R0.01 estimate or attenuation maps.
- No paid service or new Python backend; no publication. Fisheries remains deferred.

## Factual project-description status
The project analyses NASA POWER corrected precipitation and supports reviewed imports of monthly GPM IMERG Final v07 Giovanni exports, normalising values into monthly rainfall depth and comparing matched periods and documented source supports. POWER analysis has been tested on Johor records; actual Giovanni-derived analysis remains unverified until a genuine export is provided. A claim that a Giovanni dataset has already been analysed would currently be false.

## References
- https://api.giovanni.earthdata.nasa.gov/configured-variables/
- https://github.com/nasa/gesdisc-tutorials/blob/main/notebooks/How_To_Access_the_Giovanni_Averaging_Service_Using_Python.ipynb
- https://disc.gsfc.nasa.gov/datasets/GPM_3IMERGM_07/summary
- https://forum.earthdata.nasa.gov/viewtopic.php?t=6739
- https://gpm.nasa.gov/resources/faq/what-are-imerg-variables-giovanni