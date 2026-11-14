"""Authenticated bounded asynchronous job API; run one worker process."""
import hashlib
import json
import os
import secrets
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Literal
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, model_validator
from engine import VERSION, forecast
from air_quality import extract

class Observation(BaseModel):
    month: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    value: float = Field(allow_inf_nan=False)

class Request(BaseModel):
    parameter: Literal["T2M", "PRECTOTCORR", "RH2M", "WS10M", "ALLSKY_SFC_SW_DWN"]
    latitude: float = Field(ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)
    start: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    end: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    horizon: int = Field(ge=1, le=24)
    level: Literal[0.8, 0.9, 0.95]
    model: Literal["auto", "seasonal_naive", "gradient_boosted"]
    observations: list[Observation] = Field(min_length=1, max_length=600)
    provenance: dict

    @model_validator(mode="after")
    def check_period(self):
        if self.start > self.end or not (1984 if self.parameter == "ALLSKY_SFC_SW_DWN" else 1981) <= int(self.start[:4]) <= int(self.end[:4]) <= 2025:
            raise ValueError("Training years must be ordered between 1981 and 2025.")
        if self.parameter == "ALLSKY_SFC_SW_DWN":
            if self.provenance.get("normalizedUnit") != "kWh/m²/day" or self.provenance.get("community") != "RE":
                raise ValueError("Solar forecasts require validated RE monthly mean daily energy in kWh/m²/day.")
            if any(r.value < 0 for r in self.observations):
                raise ValueError("Negative solar observations must be flagged and excluded, never replaced by zero.")
        months = [r.month for r in self.observations]
        if len(months) != len(set(months)):
            raise ValueError("Duplicate monthly observations are not permitted.")
        return self

app = FastAPI(title="Earth System Trend Detective Forecast", version=VERSION)
origins = [s.strip() for s in os.environ.get("FORECAST_ALLOWED_ORIGINS", "").split(",") if s.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST", "DELETE"], allow_headers=["Authorization", "Content-Type"])
executor = ThreadPoolExecutor(max_workers=1)
lock = threading.Lock()
jobs = {}
TTL = 3600
MAX_JOBS = 32
MAX_ACTIVE = 8

def authorize(authorization: str = Header(default="")):
    token = os.environ.get("FORECAST_SERVICE_TOKEN")
    if not token:
        raise HTTPException(503, "Forecast service credential is not configured.")
    if not secrets.compare_digest(authorization, "Bearer " + token):
        raise HTTPException(401, "Forecast service authorization failed.")

@app.get("/health")
def health():
    return {"status": "ok", "version": VERSION, "airQuality": "geos-cf-v2"}

class AirPoint(BaseModel):
    latitude: float = Field(ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)

class AirRequest(BaseModel):
    points: list[AirPoint] = Field(min_length=1, max_length=2)
    horizon: Literal[24, 72, 120]

@app.post("/air-quality", dependencies=[Depends(authorize)])
def air_quality(request: AirRequest):
    try:
        return {"results": extract([p.model_dump() for p in request.points], request.horizon)}
    except ValueError as e:
        raise HTTPException(422, str(e)) from e
    except Exception as e:
        import logging
        logging.exception("NASA GEOS-CF extraction failed")
        raise HTTPException(503, "NASA GEOS-CF data could not be retrieved; no substitute data returned.") from e

def process(job_id, request):
    def update(stage):
        with lock:
            if jobs[job_id]["status"] == "cancelled":
                raise ValueError("Cancelled")
            jobs[job_id].update(status="running", stage=stage)
    try:
        result = forecast(request, update)
        with lock:
            if jobs[job_id]["status"] != "cancelled":
                jobs[job_id].update(status="completed", result=result, stage="completed")
    except Exception as e:
        with lock:
            if jobs[job_id]["status"] != "cancelled":
                jobs[job_id].update(status="failed", error=str(e) if isinstance(e, ValueError) else "Model training failed; consult service logs.")
        if not isinstance(e, ValueError):
            import traceback
            traceback.print_exc()
    finally:
        with lock:
            if job_id in jobs:
                jobs[job_id]["finished"] = True

@app.post("/jobs", dependencies=[Depends(authorize)])
def create_job(request: Request):
    data = request.model_dump()
    key = hashlib.sha256((VERSION + json.dumps(data, sort_keys=True, allow_nan=False)).encode()).hexdigest()
    with lock:
        now = time.time()
        expired = [i for i, j in jobs.items() if j.get("finished") and now - j["created"] > TTL]
        for i in expired:
            del jobs[i]
        for i, j in jobs.items():
            if j["key"] == key and j["status"] in ("queued", "running", "completed"):
                return {"id": i, "status": j["status"], **({"result": j["result"]} if j["status"] == "completed" else {})}
        if sum(not j.get("finished") for j in jobs.values()) >= MAX_ACTIVE:
            raise HTTPException(429, "Forecast queue is full. Try again after current work finishes.")
        if len(jobs) >= MAX_JOBS:
            old = next((i for i, j in jobs.items() if j.get("finished")), None)
            if old:
                del jobs[old]
        job_id = secrets.token_urlsafe(24)
        jobs[job_id] = dict(key=key, status="queued", stage="queued", created=now)
    executor.submit(process, job_id, data)
    return {"id": job_id, "status": "queued"}

@app.get("/jobs/{job_id}", dependencies=[Depends(authorize)])
def get_job(job_id: str):
    with lock:
        j = jobs.get(job_id)
        if not j:
            raise HTTPException(404, "Forecast job expired or service restarted. Submit a fresh request.")
        return {"id": job_id, **{k: v for k, v in j.items() if k not in ("key", "created")}}

@app.delete("/jobs/{job_id}", dependencies=[Depends(authorize)])
def cancel_job(job_id: str):
    with lock:
        if job_id not in jobs:
            raise HTTPException(404, "Forecast job not found.")
        if jobs[job_id]["status"] in ("queued", "running"):
            jobs[job_id]["status"] = "cancelled"
    return {"status": jobs[job_id]["status"]}
