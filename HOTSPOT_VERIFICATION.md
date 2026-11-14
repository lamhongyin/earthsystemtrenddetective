# Environmental Hotspot Explorer — tested preview

Open **Hotspots** beside Spatial Map. Production is unchanged; no publishing, paid resources, new services or credentials.

Preview: https://id-preview--86558542-1048-4fb3-bd3f-64cd5e180db9.lovable.app

## Implemented scope

- Warming, drying, and combined intersection candidates.
- Complete worldwide screening, Southeast Asia rectangle (92–142°E, 12°S–29°N), Malaysia bounding rectangle (99–120°E, 0–8°N), and drawn/input custom rectangles, including date-line crossings.
- Any 15-or-more-year interval inside the prepared 2005–2024 source range. Default 2005–2024.
- All valid cells, including oceans. No verified land-only or political-boundary mask is supplied; the interface states this explicitly.
- 5%, 10%, 20% area-weighted thresholds; four-edge connected areas, ranked by area or area-weighted relevant trend. Combined strongest-trend sorting uses temperature only and displays rainfall separately.
- Native-grid candidate overlay and fixed study boundary, exact annual evidence with OLS fitted graphs, A/B and real existing comparison actions, CSV of all jointly eligible analysed cells and JSON reproducibility details.
- Bounded worker calculation, cancellation and stale guards, source hash checking, progress, retries and no-candidate states. Failed or incomplete source loads never create a partial global result.

## Sources and methods

NASA POWER `https://gis.earthdata.nasa.gov/portal/rest/services/POWER/POWER_ANNUAL_METEOROLOGY_LST/ImageServer`.

Current multidimensional metadata verifies T2M in C (`time: mean-weighted`) and PRECTOTCORR_SUM in accumulated mm (`time: sum`); both source variables cover 1981–2025. This feature ships exact native annual arrays for 2005–2024, on a compatible 576 × 361 grid, 0.625° longitude × 0.5° latitude, MERRA-2 reanalysis, local solar time. Original TIFF hashes and resulting binary hashes are recorded. Fill -999/nonfinite remains missing; annual rainfall remains accumulated mm rather than a daily rate.

Preparation: run `bun scripts/prepare-spatial.ts --all` to obtain verified original annual TIFFs, then `bun scripts/prepare-hotspots.ts`. The latter re-checks current service metadata, compatible grid and coverage before writing annual evidence binaries and `public/hotspots/manifest.json`. Browser loads hash-verified arrays sequentially, one parameter/year batch at a time. The forecast service is never used. First cold load is about 32 MB; subsequent analyses reuse cached arrays.

Eligibility: ≥15 calendar years requested; each variable ≥90% finite annual values and ≥15 valid years, valid first and last year. Temperature and rainfall use the identical jointly eligible population. Source annual monthly completeness inherits NASA’s own aggregation and is not independently reconstructed from 12 monthly arrays.

OLS uses actual calendar years; slope is multiplied by 10. Temperature °C/decade and change in annual rainfall total mm/decade remain separate. Point/spatial Sen-slope methods differ and that distinction is visible beside the evidence. No significance, p-values, probabilities or hazard scores are generated.

Weighted quantile: inverse empirical area-weighted CDF, first ordered slope with cumulative weight ≥ percentile × total eligible area, inclusive ties. True clipped latitude/longitude cell bounds give spherical cell area using R=6371.0088 km. Warming requires positive slope at/above the upper cutoff; drying negative slope at/below lower cutoff. Combined is intersection. Constant/near-constant fields cannot manufacture strongest groups. Thresholds are relative to the frozen study area, not universal risk levels.

Grouping uses four shared edges, cyclic longitude, no missing-data bridges. The actual source grid is preserved without smoothing/jitter. Study membership is based on grid-cell centres; edge cells can extend outside the rectangular boundary. Rankings do not change when panning/zooming. Absolute rainfall trends can favour wetter climates and are not a validated drought index.

## Real-data validation

World 2005–2024, 10%: **207,936 jointly eligible cells, zero excluded**.

| Mode | Candidate cells | Connected areas |
|---|---:|---:|
| Warming | 25,569 | 194 |
| Drying | 14,936 | 560 |
| Combined | 3,650 | 176 |

Cutoffs: +0.5892857143 °C/decade; −124.9924812030 mm/decade. Highlighted warming area is 10.00% after area weighting; cell count fraction differs because cell area varies by latitude.

Johor native cell: 1.5°N, 103.75°E. NASA identify independently matched annual evidence exactly: T2M 26.875 °C (2005), 27.8125 °C (2024); rainfall 2160 mm (2005), 5152 mm (2024). SciPy `linregress` against the same 20 annual values yields +0.3839285714 °C/decade and +1059.4285714 mm/decade. Independent TypeScript worldwide results match the browser counts/cutoffs.

Browser verified every mode, ranked real member-cell graphs, full annual tables, complete CSV (207,937 lines including header), JSON (176 combined areas), changed thresholds and period, B activation and A coordinate updates, live NASA historical comparison, drawn bounds, cancellation, injected source-503 error without fabricated results, retry, desktop and 390px mobile charts without overflow. Mobile charts preserve the same source records. No browser page errors during successful flows.

Automated coverage includes positive/negative/zero OLS, actual-year missing gaps, each completeness rule, weighted quantile/ties, spherical cell area, no warming/drying/intersection, constant fields, four-edge/dateline adjacency, partial source rejection, cache/stale key identity; existing spatial tests cover leap-year rainfall and unit conversion. Full suite: **72 tests passed**, automatic preview check **build OK**.

## Limits

Prepared periods only within 2005–2024. No land mask, exact country geometry, SPI, active fire, acute heat, significance clusters or PM2.5 hotspot layer. Rectangle drag is desktop pointer-based; phones also have explicit rectangle-coordinate inputs. Whole-world candidates are complete, but Web Mercator does not display exact poles. Original annual source completeness is inherited from NASA. Source/storage outages and basemap quotas remain possible.

Forecast and air-quality implementation and credentials were not changed; this update did not repeat live Python forecast training or hosted air-quality extraction. Existing scientific regression tests still pass, and real NASA historical comparison was verified.