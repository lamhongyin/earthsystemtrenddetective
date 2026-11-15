# NASA Data Sources and Access

**Project:** Earth System Trend Detective — UTHMSPACE  
**Snapshot:** 15 November 2026; source commit `ad78f8b4f658b9468fae97b4c0e8b337e6ac7687`  
**Related files:** [README](README.md), [methodology](methodology.md), [machine learning](machine-learning.md)

This register describes the NASA products actually used by the reviewed application and distinguishes installed historical samples from live access. ITU-R, mapping and local validation sources are listed separately because they are not NASA datasets.

## 1. Source overview

| Source | Variables or role | App access | Current installed or recorded coverage |
| --- | --- | --- | --- |
| NASA POWER monthly point API | Temperature, corrected precipitation, humidity, wind and solar resource | Same-origin server proxy to the fixed monthly endpoint | App selection: 1981–2025 for weather; solar begins in 1984; actual valid returned months govern analysis |
| NASA POWER GIS image services | Native annual/monthly spatial fields | Bounded image-service requests and prepared assets | Prepared period products and annual hotspot inputs: 2005–2024 |
| GPM IMERG Final Run V07 via GES DISC/Giovanni | Monthly merged satellite–gauge precipitation | Bundled genuine Giovanni CSV and reviewed imports | 240 months, January 2005–December 2024; 102–104°E, 1–3°N |
| MODIS Aqua SST, R2019.0 | Sea-surface temperature | Prepared, checksum-verified application assets | January 2024 only |
| MODIS Aqua chlorophyll-a, R2022.0.3 | Chlorophyll-a concentration | Prepared, checksum-verified application assets | January 2024 only |
| NASA GEOS-CF v2 | Modelled PM2.5 forecasts | Python adapter reading NASA public Zarr | Request-dependent; a recorded demonstration returned 72 requested hours |
| NASA CMR and Earthdata Search | Catalogue discovery and source verification | Metadata/preparation workflow | Metadata records, not substitute numerical observations |

The date limits in the application are implementation limits. They should not be presented as the complete coverage of the underlying NASA archives.

## 2. NASA POWER monthly point data

POWER makes solar and meteorological products accessible for applications. Its meteorological inputs include reanalysis, and its solar resources use satellite-derived radiation products. A selected coordinate samples a gridded product; it does not identify a local weather station. Official references: [monthly API](https://power.larc.nasa.gov/docs/services/api/temporal/monthly/) and [methodology](https://power.larc.nasa.gov/docs/methodology/).

| Parameter | Meaning | Canonical monthly unit | Annual point-analysis result |
| --- | --- | --- | --- |
| `T2M` | Air temperature at 2 m | °C | Day-weighted mean, °C |
| `PRECTOTCORR` | Corrected precipitation | mm/day | Accumulated depth, mm |
| `RH2M` | Relative humidity at 2 m | % | Day-weighted mean, % |
| `WS10M` | Wind speed at 10 m | m/s | Day-weighted mean, m/s |
| `ALLSKY_SFC_SW_DWN` | All-sky surface shortwave downward energy on a horizontal surface | kWh/m²/day after metadata validation | Day-weighted mean daily energy; optional duration-derived energy totals |

The current weather workflow requests community `AG`; solar requests use `RE`. Community, temporal resolution and canonical-unit version are retained in cache identities to avoid incompatible reuse.

Illustrative direct POWER request:

```text
https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=T2M&community=AG&longitude=103.7414&latitude=1.4927&start=2005&end=2024&format=JSON
```

The app calls this fixed service through a server function. The example is a reproducible request pattern, not a promise of continuous upstream availability. Public POWER point access does not require a visitor Earthdata login in this workflow. Preserve response units, headers, source/version information when supplied, requested coordinates, returned geometry and retrieval time. Do not treat returned geometry as independently verified grid-cell identity.

## 3. POWER worldwide spatial data

The app uses NASA GIS services, including:

- [Annual meteorology image service](https://gis.earthdata.nasa.gov/portal/rest/services/POWER/POWER_ANNUAL_METEOROLOGY_LST/ImageServer)
- [Annual radiation image service](https://gis.earthdata.nasa.gov/portal/rest/services/POWER/POWER_ANNUAL_RADIATION_LST/ImageServer)

Installed manifests identify meteorology support as 0.5° latitude × 0.625° longitude and radiation support as 1° × 1°. These are different products and must not be treated as identical grids. Prepared layers preserve axis orientation, source units, source hashes and missing values.

The 2005–2024 spatial Sen product requires 20 finite annual values per cell. Hotspots use prepared annual temperature and rainfall arrays with their own completeness rules and OLS method. Spatial annual source aggregation is inherited from NASA; it need not reproduce every rounded value obtained by independently aggregating the monthly point API.

For prepared annual radiation fields with verified mean-flux units, conversion is mean W/m² × 24 / 1000 to mean daily kWh/m². This documented preparation rule does not permit relabelling arbitrary unknown units elsewhere.

## 4. GPM IMERG Final Run V07 and Giovanni

**Product:** `GPM_3IMERGM_07`  
**Dataset DOI:** [10.5067/GPM/IMERG/3B-MONTH/07](https://doi.org/10.5067/GPM/IMERG/3B-MONTH/07)  
**Catalogue:** [GES DISC monthly IMERG](https://disc.gsfc.nasa.gov/datasets/GPM_3IMERGM_07/summary)  
**Documentation:** [NASA GPM data directory](https://gpm.nasa.gov/data/directory) and [data FAQ](https://gpm.nasa.gov/data/faq)  
**Analysis tool:** [Giovanni](https://giovanni.gsfc.nasa.gov/giovanni/)

IMERG combines multiple satellite inputs, and its Final product uses monthly gauge information. The native monthly grid is 0.1°. The installed sample is an **area-averaged series**, so its spatial support is the selected rectangle rather than an individual native cell or gauge.

| Sample property | Value |
| --- | --- |
| Requested period | 1 January 2005–31 December 2024 |
| Requested bounding box, west/south/east/north | `102,1,104,3` |
| Exported data-centre bounds | `102.05,1.05,103.95,2.95` |
| Monthly observations | 240 |
| Export variable | `mean_GPM_3IMERGM_07_precipitation` |
| Source-rate handling | Reviewed as mm/hour; multiply by actual monthly hours for depth |
| Repository asset | `public/data/imerg-demo-2005-2024.csv` |

The CSV preserves a Giovanni reproduction URL and fill-value metadata. The rectangle contains land and sea and is not Johor’s administrative boundary. The supplied demonstration is available without visitor downloads; arbitrary new regions and periods require reviewed data imports. CMR discovery alone does not implement authenticated numerical retrieval.

POWER `PRECTOTCORR` and IMERG are distinct precipitation products. Differences between them are product comparisons unless appropriate independent gauge data are provided; one must not automatically be called ground truth for the other. Monthly totals cannot resolve one-minute rainfall intensity.

## 5. MODIS Aqua ocean data

The fisheries demonstration installs a matched historical month:

| Property | SST | Chlorophyll-a |
| --- | --- | --- |
| Satellite/sensor | Aqua MODIS | Aqua MODIS |
| File | `AQUA_MODIS.20240101_20240131.L3m.MO.SST.sst.9km.nc` | `AQUA_MODIS.20240101_20240131.L3m.MO.CHL.chlor_a.9km.nc` |
| Variable | `sst` | `chlor_a` |
| Processing version in installed manifest | R2019.0 | R2022.0.3 |
| Native grid | 2160 × 4320, nominal 9 km / 1⁄12° | Same grid |
| Display unit | °C | mg/m³ |
| Worldwide overview | 1° area-weighted cells | 1° area-weighted cells |
| Installed period | January 2024 only | January 2024 only |
| Earthdata collection | `C1615905770-OB_DAAC` | `C3380709133-OB_CLOUD` |

Collection links: [SST Earthdata Search](https://search.earthdata.nasa.gov/search/granules?p=C1615905770-OB_DAAC) and [chlorophyll Earthdata Search](https://search.earthdata.nasa.gov/search/granules?p=C3380709133-OB_CLOUD).

The installed source manifest is `public/fisheries/manifest.json`, schema `nasa-prepared-modis-v2`. It records input filenames, source URLs, byte sizes, hashes, processing versions, observation bounds, units, masks and prepared asset identities.

Source-file time coverage crosses the nominal month boundary slightly. The manifest preserves actual observation bounds separately from the January composite label and preparation date. SST uses decoded packing/fill, `qual_sst` 0/1 and the reviewed range; chlorophyll uses its own validity rules. A fixed ocean mask and ≥70% valid eligible-area rule govern the 1° overview. Missing cells stay missing.

Prepared histories support six configured point/region entries per product, not arbitrary-location histories. Visitors use installed assets without uploading NetCDF files or signing into Earthdata. There is no unattended refresh or multi-year ocean archive in this snapshot.

**The fish icons are purely artificial illustrations.** They are not NASA fish detections, population observations, habitat scores or catch predictions, and are excluded from scientific exports.

## 6. NASA GEOS-CF v2

GEOS-CF is a global atmospheric-composition modelling system. The project’s PM2.5 panel uses model output, not monitoring-station measurements. Official references: [system description](https://gmao.gsfc.nasa.gov/gmao-products/geos-cf/system-description_geos-cf/), [data access](https://gmao.gsfc.nasa.gov/gmao-products/geos-cf/data-access_geos-cf/) and [FAQ](https://gmao.gsfc.nasa.gov/gmao-products/geos-cf/faq_geos-cf/).

The Python adapter reads the fixed public HTTPS Zarr store:

```text
https://smce-geos-cf-public.s3.amazonaws.com/geos-cf-v2-fcst-latest.zarr
```

The selected model grid is approximately 0.25° × 0.25°. The service supports 24-, 72- or 120-hour requests for at most two points, subject to actual source coverage. It keeps requested coordinates separate from the sampled grid point, checks units and the near-surface model layer, and verifies snapshot/chunk identity around reads to detect source rollover.

The response retains retrieval time, valid intervals and snapshot identity. Missing initialization metadata remains null. A stale forecast remains a dated model forecast; it does not become an observation. Derived indices are labelled **US EPA scale — PM2.5 only — NASA model estimate**, with no invented confidence bands or local accuracy scores.

GEOS-CF is accessed by the separately hosted Python service. It is distinct from the project’s own monthly gradient-boosting forecast. No CFAPI credential is required for this particular anonymous public-store route.

## 7. Catalogue and preparation tools

[CMR](https://cmr.earthdata.nasa.gov/search/site/docs/search/api.html), [Earthdata Search](https://search.earthdata.nasa.gov/) and [earthaccess](https://earthaccess.readthedocs.io/en/stable/) support discovery, authentication where needed and scientific preparation. Metadata availability does not prove that an actual numeric file was downloaded and validated. NetCDF/xarray preparation must decode units, scale factors, fill values, coordinates and quality fields before producing app assets.

## 8. Separate non-NASA inputs and services

| Input/service | Purpose | Distinction |
| --- | --- | --- |
| [ITU-R P.837-8](https://www.itu.int/rec/R-REC-P.837-8-202509-I/en) | Rain climatology | Separate from monthly NASA rainfall |
| [ITU-R P.839-4](https://www.itu.int/rec/R-REC-P.839-4-201309-I/en) | Rain-height model | Separate climatological field |
| [ITU-R P.838-3](https://www.itu.int/rec/R-REC-P.838-3-200503-I/en) | Rain-specific attenuation | Propagation equation reference |
| [ITU-R P.618-14](https://www.itu.int/rec/R-REC-P.618-14-202308-I/en) | Satellite-link propagation | Scenario model |
| [ITU-R P.530-19](https://www.itu.int/rec/R-REC-P.530-19-202509-I/en) | Terrestrial propagation | Hypothetical reference-link model |
| Google Maps/Places; Leaflet/OpenStreetMap | Location selection and basemaps | Cartography, not environmental measurements |
| EPA index conventions | PM2.5 index conversion | Does not make a NASA model value an official local observation |
| Malaysian monitoring/gauge records | Potential independent validation | No real paired fine-interval rainfall validation files in the reviewed workflow |

The current attenuation work record reports hosted, hash-verified ITU originals following the owner’s stated permission, with local file input retained. That permission statement was not independently reviewed for this documentation. Downloading an official archive does not itself establish redistribution rights; this package contains references and descriptions rather than those source grids.

## 9. Attribution and reproducibility

Every exported investigation should retain the product/parameter, version, dates, location or bounds, source unit, conversion, missing-data rule, retrieval/preparation time and calculation settings. Prepared assets also retain hashes and display resolution. Distinguish observed or retrieved environmental estimates, model forecasts, scenario calculations and artificial illustrations.

Credit NASA POWER, NASA GPM/GES DISC/Giovanni, NASA OB.DAAC and NASA GMAO GEOS-CF for their respective products. For GEOS-CF scientific context, see NASA’s [recommended citations](https://gmao.gsfc.nasa.gov/gmao-products/geos-cf/citing-geos-cf-data_geos-cf/) and the research references in [literature-review.md](literature-review.md).
