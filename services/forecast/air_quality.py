"""Public NASA GEOS-CF v2 point extraction; EPA-403/B-26-003, May 2026."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_DOWN, ROUND_HALF_UP
import hashlib
from collections import OrderedDict
import math
import threading
import requests
import numpy as np
import xarray as xr
import fsspec

STORE = "https://smce-geos-cf-public.s3.amazonaws.com/geos-cf-v2-fcst-latest.zarr"
STANDARD = "US EPA PM2.5 · EPA-403/B-26-003 · May 2026"
DOC = "https://gmao.gsfc.nasa.gov/gmao-products/geos-cf/documentation_geos-cf/"
COLLECTION = "aqc_tavg_1hr_glo_L1440x721_slv"
BRACKETS = [("0", "9", 0, 50, "Good"), ("9.1", "35.4", 51, 100, "Moderate"),
            ("35.5", "55.4", 101, 150, "Unhealthy for Sensitive Groups"),
            ("55.5", "125.4", 151, 200, "Unhealthy"),
            ("125.5", "225.4", 201, 300, "Very Unhealthy"),
            ("225.5", "325.4", 301, 500, "Hazardous")]
gate = threading.BoundedSemaphore(2)
cache_lock = threading.Lock()
point_cache = OrderedDict()

def object_identity(key):
    response = requests.head(STORE + "/" + key, timeout=30)
    response.raise_for_status()
    etag = response.headers.get("ETag")
    if not etag:
        raise ValueError("NASA source object identity unavailable; safe extraction cannot be verified.")
    return etag

def iso(t):
    return t.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

def index_for(mean):
    c = Decimal(str(mean)).quantize(Decimal("0.1"), rounding=ROUND_DOWN)
    if c < 0 or not c.is_finite():
        raise ValueError("PM2.5 must be finite and nonnegative.")
    if c > Decimal("325.4"):
        return dict(truncatedPm25=float(c), aqi=None, aboveScale=True, category="Above AQI 500 / beyond scale")
    for lo, hi, il, ih, category in BRACKETS:
        if Decimal(lo) <= c <= Decimal(hi):
            i = (c - Decimal(lo)) * (ih - il) / (Decimal(hi) - Decimal(lo)) + il
            return dict(truncatedPm25=float(c), aqi=int(i.quantize(Decimal("1"), rounding=ROUND_HALF_UP)), aboveScale=False, category=category)
    raise ValueError("Unsupported concentration bracket.")

def window(rows, start, end):
    valid = [r for r in rows if r["pm25"] is not None and r["intervalStart"] >= iso(start) and r["intervalEnd"] <= iso(end)]
    expected = [iso(start + timedelta(hours=h)) for h in range(24)]
    complete = len(valid) == 24 and sorted(r["intervalStart"] for r in valid) == expected and all(
        datetime.fromisoformat(r["intervalEnd"].replace("Z", "+00:00")) - datetime.fromisoformat(r["intervalStart"].replace("Z", "+00:00")) == timedelta(hours=1) for r in valid)
    mean = sum((Decimal(str(r["pm25"])) for r in valid), Decimal(0)) / 24 if complete else None
    return dict(start=iso(start), end=iso(end), validHours=len(valid), meanPm25=float(mean) if mean is not None else None,
                **(index_for(mean) if complete else dict(truncatedPm25=None, aqi=None, aboveScale=False, category=None)))

def summarize(rows):
    windows = []
    for r in rows:
        end = datetime.fromisoformat(r["intervalEnd"].replace("Z", "+00:00"))
        windows.append(window(rows, end - timedelta(hours=24), end))
    days = []
    if rows:
        first = datetime.fromisoformat(rows[0]["intervalStart"].replace("Z", "+00:00")).replace(hour=0)
        last = datetime.fromisoformat(rows[-1]["intervalStart"].replace("Z", "+00:00"))
        while first <= last:
            days.append(window(rows, first, first + timedelta(days=1)))
            first += timedelta(days=1)
    return windows, days

def nearest(latitudes, longitudes, lat, lon):
    return int(np.argmin(np.abs(latitudes - lat))), int(np.argmin(np.abs((longitudes - lon + 180) % 360 - 180)))

def conversion(unit):
    if unit in ("ug m-3", "µg/m³", "μg/m³"):
        return 1.0
    if unit in ("kg m-3", "kg/m³"):
        return 1e9
    raise ValueError("Unrecognized NASA PM2.5 units; no conversion attempted.")

def clean(value, attrs, fill):
    if not math.isfinite(value) or value < 0:
        return None
    sentinels = [fill, attrs.get("missing_value"), attrs.get("_FillValue"), attrs.get("fmissing_value")]
    if any(s is not None and math.isfinite(float(s)) and np.isclose(value, float(s), rtol=1e-7, atol=0) for s in sentinels):
        return None
    lo, hi = attrs.get("valid_range", [float("-inf"), float("inf")])
    return value if lo <= value <= hi else None

def manifest():
    response = requests.get(STORE + "/.zmetadata", timeout=30)
    response.raise_for_status()
    raw = response.content
    return response.json(), dict(etag=response.headers.get("ETag"), lastModified=response.headers.get("Last-Modified"), metadataSha256=hashlib.sha256(raw).hexdigest())

def extract(points, horizon, now=None):
    """Batch points into one stable source snapshot; never download the global cube."""
    if horizon not in (24, 72, 120) or not 1 <= len(points) <= 2:
        raise ValueError("Choose one or two points and 24, 72 or 120 hours.")
    if any(not math.isfinite(p[k]) or not low <= p[k] <= high for p in points for k, low, high in [("latitude", -90, 90), ("longitude", -180, 180)]):
        raise ValueError("Invalid coordinates.")
    now = now or datetime.now(timezone.utc)
    with gate:
        for attempt in range(2):
            meta, identity = manifest()
            attrs = meta["metadata"]["pm25_rh35/.zattrs"]
            factor = conversion(attrs.get("units"))
            if attrs.get("_ARRAY_DIMENSIONS") != ["time", "lev", "lat", "lon"] or "RH 35%" not in attrs.get("long_name", ""):
                raise ValueError("NASA variable definition changed; adapter verification required.")
            mapper = fsspec.get_mapper(STORE, timeout=30)
            with xr.open_zarr(mapper, consolidated=True, chunks=None, mask_and_scale=False) as ds:
                lev = ds.lev.values
                # FileSpec v2 §4: hourly averages are midpoint-stamped; §5.2: surface is model layer 72.
                if len(lev) != 1 or float(lev[0]) != 72 or ds.lev.attrs.get("standard_name") != "model_level_number":
                    raise ValueError("NASA surface level 72 could not be verified.")
                times = ds.time.values.copy()
                dates = [datetime.fromisoformat(np.datetime_as_string(t, unit="s")).replace(tzinfo=timezone.utc) for t in times]
                if any(t.minute != 30 or t.second != 0 for t in dates) or any(b-a != timedelta(hours=1) for a,b in zip(dates, dates[1:])):
                    raise ValueError("NASA hourly midpoint coverage changed; temporal verification required.")
                results = []
                objects = {"time/0": object_identity("time/0")}
                chunks = meta["metadata"]["pm25_rh35/.zarray"]["chunks"]
                if chunks[0] != len(dates) or chunks[1] != 1:
                    raise ValueError("NASA chunk layout changed; source consistency verification required.")
                for p in points:
                    iy, ix = nearest(ds.lat.values, ds.lon.values, p["latitude"], p["longitude"])
                    chunk = f"pm25_rh35/0.0.{iy // chunks[2]}.{ix // chunks[3]}"
                    objects[chunk] = object_identity(chunk)
                    cache_key = (identity["metadataSha256"], objects["time/0"], objects[chunk], iy, ix)
                    with cache_lock:
                        cached = point_cache.get(cache_key)
                    values = cached.copy() if cached is not None else ds.pm25_rh35.isel(lev=0, lat=iy, lon=ix).values.copy()
                    fill = meta["metadata"]["pm25_rh35/.zarray"].get("fill_value")
                    rows = []
                    for t, v in zip(dates, values):
                        value = clean(float(v), attrs, fill)
                        rows.append(dict(intervalStart=iso(t-timedelta(minutes=30)), intervalEnd=iso(t+timedelta(minutes=30)), originalTime=iso(t), pm25=None if value is None else value*factor))
                    windows, daily = summarize(rows)
                    start = now.replace(minute=0, second=0, microsecond=0)
                    stop = start + timedelta(hours=horizon)
                    forecast_rows = [r for r in rows if r["intervalStart"] >= iso(start) and r["intervalEnd"] <= iso(stop)]
                    warnings = ["Model forecasts, not monitoring-station measurements.", "Initialization time is not provided by this store; valid-time coverage is reported instead.", "Prediction interval not available for this forecast.", "Local validation not yet available."]
                    if len(forecast_rows) < horizon:
                        warnings.append(f"Requested {horizon} future hours; only {len(forecast_rows)} source hours remain. No extrapolation.")
                    if any(r["pm25"] is None for r in rows):
                        warnings.append("Invalid or missing concentrations excluded; strict 24-hour indices require complete coverage.")
                    results.append(dict(source="NASA GEOS-CF", dataType="forecast", modelVersion="GEOS-CF v2", collection=COLLECTION,
                        snapshotId=identity["metadataSha256"] + ":" + iso(dates[0]), initializedAt=None, retrievedAt=iso(now),
                        sourceUrl=STORE, sourceObjects={**identity, "timeETag": objects["time/0"], "pointChunkETag": objects[chunk]}, requestedPoint=p, gridPoint=dict(latitude=float(ds.lat.values[iy]), longitude=float(ds.lon.values[ix])),
                        variable="pm25_rh35", variableDefinition=attrs["long_name"], surfaceLayer=72, unit="µg/m³", originalUnit=attrs["units"], conversionFactor=factor,
                        indexStandard=STANDARD, indexScope="PM2.5 only", completenessPolicy="24 unique contiguous valid one-hour averages; UTC calendar; decimal truncation and half-up index rounding",
                        temporalDefinition="Hourly averages centered at source timestamps (GEOS-CF FileSpec v2 §4)", documentation=DOC,
                        coverageStart=rows[0]["intervalStart"], coverageEnd=rows[-1]["intervalEnd"], requestedHours=horizon, availableFutureHours=len(forecast_rows),
                        forecastWindowStart=iso(start), forecastWindowEnd=iso(stop), hours=rows, windows24h=windows, daily=daily, warnings=warnings))
                    with cache_lock:
                        point_cache[cache_key] = values.copy()
                        while len(point_cache) > 32:
                            point_cache.popitem(last=False)
                after_times = ds.time.values.copy()
            _, after = manifest()
            # Check time object too: an in-place rollover can retain identical array metadata.
            with xr.open_zarr(fsspec.get_mapper(STORE, timeout=30), consolidated=True, chunks=None, mask_and_scale=False) as verify:
                stable = np.array_equal(times, verify.time.values)
            objects_stable = all(object_identity(k) == v for k, v in objects.items())
            if identity == after and np.array_equal(times, after_times) and stable and objects_stable:
                return results
        raise ValueError("NASA forecast changed during extraction; retry for a consistent run.")