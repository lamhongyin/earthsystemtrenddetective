# Fisheries NASA-direct preparation

## Current status
Serving no longer contacts NOAA or any NASA upstream. No science bundle is installed: the empty manifest deliberately advertises no dates. NASA CMR discovery verified these January 2024 granules, but their scientific download requires NASA Earthdata access; no Earthdata credential is configured in Lovable. No unattended job is configured and no paid resources were created.

- SST: `MODISA_L3m_SST`, `C1615905770-OB_DAAC`, R2019.0, 11 µm **daytime** 9 km monthly `sst`. Granule `AQUA_MODIS.20240101_20240131.L3m.MO.SST.sst.9km.nc`.
- Chlorophyll: `MODISA_L3m_CHL`, `C3380709133-OB_CLOUD`, 2022.0, 9 km monthly `chlor_a`. Granule `AQUA_MODIS.20240101_20240131.L3m.MO.CHL.chlor_a.9km.nc`.

This SST replaces the former NOAA monthly MUR foundation-temperature derivative and is not an equivalent series. Chlorophyll is the direct NASA monthly product, not a relabelled NOAA array. No old ocean records are reused. MODIS Aqua is the observational instrument; NASA source files retain contributor/processing provenance.

## Maintainer preparation / refresh

Use a supported Python environment, not the deployed web request runtime:

```sh
python3 -m pip install -r scripts/fisheries-requirements.txt
python3 scripts/prepare-fisheries.py --start 2024 --end 2024
```

Use secure environment Earthdata credentials supported by `earthaccess.login(strategy="environment")`, never chat or repository files. Alternatively, download the verified NASA NetCDF files through your Earthdata account and provide their folder with `--input-dir /path/to/nasa-files`. For a bounded first bundle use `--start 2024 --end 2024`; 2005–2024 is supported with a maximum 240 months, but depends on real source completeness. This is manual preparation; existing saved data needs no continuously running computer.

Preparation fetches one granule at a time with bounded discovery retries. It verifies NASA product_name, processing version, units, 2160×4320 north-to-south grid, CF packing/fill and SST quality where supplied. It creates numerical worldwide 1° area-weighted overviews and exact native-grid histories for three points and three preset regions. A fixed `global-land-mask` GSHHG-derived mask defines eligible sea area; it does not independently classify lakes/ice. Missing clouds remain missing; 70% valid eligible area is required for means. The supplied-file path still verifies public CMR granule discovery. No image colours are decoded into measurements.

Source hashes, granule observation bounds, retrieval time, native/display resolutions, mask, quality, aggregation and supported histories are recorded in each manifest. Dependencies are bounded to 8 MB each. New immutable versioned assets are written and verified before the active manifest is atomically replaced; failed refreshes leave prior verified assets/manifest intact and record a separate sanitized refresh-status file. Commit/deploy the whole asset directory together; do not publish a manifest without its dependencies. Static versioned assets use browser force-cache and the active manifest uses no-cache. No new scheduler is installed.

Public requests read only app-hosted `/fisheries/` assets and verify checksums. Unsupported histories are explicitly unavailable, not substituted. Arbitrary clicked points sample the prepared 1° numeric overview, **not** a native cell or preloaded site's history. Each source has independent dates/map errors and Retry; map retries do not restart history.

## Acceptance still blocked

Real map rendering, source-value parity, native histories/exports and saved-data survival during an upstream failure cannot be accepted until authenticated NASA files are prepared. Never present the empty archive or synthetic test fixtures as a completed science repair. The UI honestly reports “No prepared dates available.” Production remains unpublished.