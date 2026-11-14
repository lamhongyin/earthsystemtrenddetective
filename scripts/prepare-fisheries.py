"""Bounded NASA CMR discovery / authenticated download / atomic app bundle preparation.

Run in a Python preparation environment, never in a request worker.
No existing bundle is modified if discovery, scientific validation or preparation fails.
"""
import argparse
import calendar
import hashlib
import json
import os
from pathlib import Path
import shutil
import tempfile
import time
from datetime import datetime, timezone

VERSION = "nasa-prepared-modis-v2"
PRODUCTS = {
    "sst": dict(collection="C1615905770-OB_DAAC", id="MODISA_L3m_SST", version="R2019.0", variable="sst", suffix="SST.sst", units="°C", doi="https://doi.org/10.5067/MODSA-MO4D9", title="MODIS Aqua monthly SST · 11 µm daytime"),
    "chlorophyll": dict(collection="C3380709133-OB_CLOUD", id="MODISA_L3m_CHL", version="2022.0", variable="chlor_a", suffix="CHL.chlor_a", units="mg/m³", doi="https://oceancolor.gsfc.nasa.gov/data/reprocessing/", title="MODIS Aqua monthly chlorophyll-a"),
}
POINTS = [(1.8, 104.5), (5.05, 110.05), (2.8, 101.0)]
REGIONS = [(1.70, 1.80, 104.45, 104.55), (2.75, 2.85, 100.95, 101.05), (5.00, 5.10, 110.00, 110.10)]

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def dump(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":")))

def discover(session, product, month):
    last = calendar.monthrange(int(month[:4]), int(month[5:]))[1]
    name = f"AQUA_MODIS.{month.replace('-', '')}01_{month.replace('-', '')}{last}.L3m.MO.{product['suffix']}.9km.nc"
    r = session.get("https://cmr.earthdata.nasa.gov/search/granules.json", params={"collection_concept_id": product["collection"], "producer_granule_id": name, "page_size": 2}, timeout=45)
    r.raise_for_status()
    entries = r.json()["feed"]["entry"]
    if len(entries) != 1 or entries[0]["producer_granule_id"] != name:
        raise ValueError("NASA did not return exactly one verified monthly 9 km granule.")
    return entries[0]

def obtain(granule, cache, supplied):
    name = granule["producer_granule_id"]
    path = (supplied / name) if supplied else (cache / name)
    if path.exists():
        return path
    # earthaccess handles NASA's documented redirect/authentication workflow.
    if not os.environ.get("EARTHDATA_TOKEN") and not (os.environ.get("EARTHDATA_USERNAME") and os.environ.get("EARTHDATA_PASSWORD")):
        raise RuntimeError("NASA Earthdata access is not configured. Supply authenticated NASA NetCDF files with --input-dir or use secure Earthdata environment credentials.")
    import earthaccess
    earthaccess.login(strategy="environment", persist=False)
    results = earthaccess.search_data(short_name=granule["dataset_id"].split()[0] if False else next(p["id"] for p in PRODUCTS.values() if p["collection"] == granule["collection_concept_id"]), granule_name=name, count=2)
    if len(results) != 1:
        raise ValueError("Authenticated NASA discovery is ambiguous.")
    downloaded = earthaccess.download(results, str(cache), threads=1)
    if len(downloaded) != 1:
        raise ValueError("NASA download did not complete.")
    return Path(downloaded[0])

def read_science(path, product, granule):
    import numpy as np
    import xarray as xr
    with xr.open_dataset(path, decode_cf=True, mask_and_scale=True) as ds:
        if ds.attrs.get("product_name") != granule["producer_granule_id"]:
            raise ValueError("NASA file product_name differs from discovered granule.")
        processing = str(ds.attrs.get("processing_version", ""))
        if processing.removeprefix("R") != product["version"].removeprefix("R"):
            raise ValueError("NASA processing version changed; do not splice this file.")
        field = ds[product["variable"]].transpose("lat", "lon")
        values = field.values.astype("float64")
        lat, lon = ds.lat.values.astype("float64"), ds.lon.values.astype("float64")
        if values.shape != (2160, 4320) or not np.allclose(np.diff(lat), -1 / 12, atol=1e-4) or not np.allclose(np.diff(lon), 1 / 12, atol=1e-4):
            raise ValueError("Expected NASA 9 km north-to-south 2160 × 4320 grid.")
        unit = str(field.attrs.get("units", ""))
        if product["variable"] == "sst":
            if unit in ("K", "kelvin"):
                values -= 273.15
            elif unit not in ("degree_C", "degrees_C", "degrees Celsius", "degC"):
                raise ValueError("Unsupported NASA SST units.")
            if "qual_sst" in ds:
                quality = ds.qual_sst.transpose("lat", "lon").values
                values[~np.isin(quality, [0, 1])] = np.nan
            if not field.attrs.get("valid_min") is None and not field.attrs.get("valid_max") is None:
                # xarray applies packing but valid_range remains in packed coordinates.
                raw = xr.open_dataset(path, decode_cf=False)
                try:
                    attrs = raw[product["variable"]].attrs
                    scale, offset = attrs.get("scale_factor", 1), attrs.get("add_offset", 0)
                    lo, hi = attrs.get("valid_min", -32767) * scale + offset, attrs.get("valid_max", 32767) * scale + offset
                    if unit in ("K", "kelvin"):
                        lo -= 273.15; hi -= 273.15
                    values[(values < lo) | (values > hi)] = np.nan
                finally:
                    raw.close()
            values[(values < -2) | (values > 45)] = np.nan
        else:
            if unit not in ("mg m^-3", "mg m-3", "mg m**-3", "mg/m^3"):
                raise ValueError("Unsupported NASA chlorophyll units.")
            values[(values < 0.001) | (values > 100)] = np.nan
        return values, lat, lon, dict(ds.attrs), dict(field.attrs)

def prepare(args):
    import numpy as np
    import requests
    import global_land_mask
    session = requests.Session()
    adapter = requests.adapters.HTTPAdapter(max_retries=__import__("urllib3").util.Retry(total=2, backoff_factor=2, status_forcelist=[429, 500, 502, 503, 504]))
    session.mount("https://", adapter)
    now = datetime.now(timezone.utc)
    months = [f"{y}-{m:02d}" for y in range(args.start, args.end + 1) for m in range(1, 13) if f"{y}-{m:02d}" < now.strftime("%Y-%m")]
    if not months or len(months) > 240:
        raise ValueError("Prepare 1–240 complete months per run.")
    root = Path(args.output); root.mkdir(parents=True, exist_ok=True)
    cache = Path(args.cache); cache.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix="fisheries-"))
    timestamp = now.isoformat().replace("+00:00", "Z")
    bundle = now.strftime("modis-%Y%m%dT%H%M%S")
    manifest = dict(schema=VERSION, bundle=bundle, createdAt=timestamp, sources={})
    try:
        for code, product in PRODUCTS.items():
            if code not in args.sources.split(","):
                continue
            maps, evidence = {}, []
            histories = []
            for lat, lon in POINTS:
                histories.append(dict(target=dict(lat=lat, lon=lon), cell=None, months=[], maskMethod="Fixed globe mask v1.0.0 (GSHHG-derived); nearest NASA native cell; monthly composite fill/range/quality applied. No interpolation."))
            for south, north, west, east in REGIONS:
                histories.append(dict(target=dict(lat=(south + north) / 2, lon=(west + east) / 2, bounds=dict(south=south, north=north, west=west, east=east)), cell=None, months=[], maskMethod="Fixed globe mask v1.0.0; clipped spherical native-cell area; ≥70% valid eligible area required."))
            for date in months:
                g = discover(session, product, date)
                path = obtain(g, cache, Path(args.input_dir) if args.input_dir else None)
                values, lat, lon, attrs, field_attrs = read_science(path, product, g)
                ocean = ~global_land_mask.globe.is_land(lat[:, None], lon[None, :])
                values[~ocean] = np.nan
                weights = np.cos(np.radians(lat))[:, None] * np.ones((1, len(lon)))
                valid = np.isfinite(values)
                def block_sum(a):
                    return a.reshape(180, 12, 360, 12).sum(axis=(1, 3))
                total = block_sum(weights * ocean); present = block_sum(weights * valid)
                coverage = np.divide(present, total, out=np.zeros_like(total), where=total > 0)
                means = np.divide(block_sum(np.where(valid, values, 0) * weights), present, out=np.full_like(total, np.nan), where=(present > 0) & (coverage >= .7))
                payload = dict(width=360, height=180, month=date, bounds=dict(south=-90, north=90, west=-180, east=180), values=[float(x) if np.isfinite(x) else None for x in means.ravel()], coverage=coverage.ravel().tolist())
                filename = f"{code}-{date}.json"; dump(stage / filename, payload)
                maps[date] = dict(path=f"/fisheries/{bundle}/{filename}", sha256=sha(stage / filename), bytes=(stage / filename).stat().st_size)
                for h in histories:
                    target = h["target"]
                    if "bounds" not in target:
                        y, x = np.argmin(abs(lat - target["lat"])), np.argmin(abs(lon - target["lon"]))
                        v = values[y, x]; ok = bool(np.isfinite(v)); eligible = bool(ocean[y, x])
                        h["cell"] = dict(lat=float(lat[y]), lon=float(lon[x]))
                        row = dict(month=date, value=float(v) if ok else None, coverage=float(ok), validCells=int(ok), oceanCells=int(eligible))
                    else:
                        b = target["bounds"]
                        north = np.minimum(lat + 1 / 24, b["north"]); south = np.maximum(lat - 1 / 24, b["south"])
                        widths = np.maximum(0, np.minimum(lon + 1 / 24, b["east"]) - np.maximum(lon - 1 / 24, b["west"]))
                        w = np.maximum(0, np.sin(np.radians(north)) - np.sin(np.radians(south)))[:, None] * widths[None, :] * ocean
                        totalw = w.sum(); validw = (w * valid).sum(); cov = float(validw / totalw) if totalw else 0
                        row = dict(month=date, value=float((np.where(valid, values, 0) * w).sum() / validw) if validw and cov >= .7 else None, coverage=cov, validCells=int(((w > 0) & valid).sum()), oceanCells=int((w > 0).sum()))
                    h["months"].append(row)
                evidence.append(dict(granule=g["producer_granule_id"], concept=g["id"], start=g["time_start"], end=g["time_end"], sha256=sha(path), bytes=path.stat().st_size, processingVersion=attrs.get("processing_version"), sourceUnits=field_attrs.get("units")))
                time.sleep(.2)
            filename = f"{code}-histories.json"; dump(stage / filename, histories)
            metadata = dict(id=product["id"], title=product["title"], start=months[0], end=months[-1], times=months, unit=product["units"], version=product["version"], summary="NASA OB.DAAC MODIS Aqua Level-3 mapped monthly science composite; source cells 9 km, overview 1° area weighted.", latFirst=float(lat[0]), latLast=float(lat[-1]), lonFirst=float(lon[0]), lonLast=float(lon[-1]), retrievedAt=timestamp, resolution=1 / 12)
            manifest["sources"][code] = dict(metadata=metadata, maps=maps, histories=dict(path=f"/fisheries/{bundle}/{filename}", sha256=sha(stage / filename), bytes=(stage / filename).stat().st_size), provenance=dict(collection=product["collection"], doi=product["doi"], granules=evidence, crs="EPSG:4326", sourceResolution="9 km; 1/12°", preparedResolution="1°", axisOrder="latitude north to south, longitude west to east", nodata="JSON null", mask="global-land-mask 1.0.0, GSHHG-derived; fixed each month; lakes and ice not independently classified", aggregation="clipped spherical area; 70% eligible coverage; no interpolation", quality="native CF packing and fill decoded; chlor_a 0.001–100 mg/m³; SST -2–45°C plus native range and qual_sst 0/1 when supplied", locations=[h["target"] for h in histories], calculationVersion=VERSION))
        if not manifest["sources"]:
            raise ValueError("No sources selected.")
        for s in manifest["sources"].values():
            for spec in [*s["maps"].values(), s["histories"]]:
                p = stage / Path(spec["path"]).name
                if sha(p) != spec["sha256"] or p.stat().st_size != spec["bytes"] or spec["bytes"] > 8_000_000:
                    raise ValueError("Prepared asset integrity or size failure.")
        destination = root / bundle
        if destination.exists():
            raise ValueError("Bundle identifier already exists; never overwrite versioned assets.")
        shutil.copytree(stage, destination)
        pending = root / "manifest.pending.json"; dump(pending, manifest); pending.replace(root / "manifest.json")
        (root / "refresh-status.json").write_text(json.dumps(dict(ok=True, checkedAt=timestamp)))
        print(f"Prepared {len(months)} months for {', '.join(manifest['sources'])}; manifest activated last.")
    except Exception:
        # No upstream exception text (redirects could contain credentials) is persisted.
        dump(root / "refresh-status.json", dict(ok=False, checkedAt=timestamp, error="NASA preparation failed; previous verified bundle retained."))
        raise
    finally:
        shutil.rmtree(stage)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start", type=int, default=2024); parser.add_argument("--end", type=int, default=2024)
    parser.add_argument("--sources", default="sst,chlorophyll")
    parser.add_argument("--input-dir"); parser.add_argument("--cache", default="/tmp/fisheries-nasa")
    parser.add_argument("--output", default="public/fisheries")
    try:
        prepare(parser.parse_args())
    except Exception as exc:
        print("Preparation failed; no verified manifest was replaced. Check scientific files and secure Earthdata setup.")
        raise SystemExit(1) from None