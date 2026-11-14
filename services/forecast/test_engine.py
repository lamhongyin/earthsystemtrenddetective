import math
import numpy as np
import pytest
from fastapi.testclient import TestClient
from engine import (segment, features, baseline, training_origins, postprocess, bounds, quantile, metrics, forecast, month_string)
from app import app


def request(h=3, model="seasonal_naive", level=0.95, n=180):
    return dict(parameter="T2M", latitude=1.4927, longitude=103.7414, start="2000-01", end=month_string(2000*12+n-1), horizon=h, level=level, model=model, provenance={"source":"test"}, observations=[{"month": month_string(2000*12+i), "value": 20+2*math.sin(i*2*math.pi/12)+0.005*i} for i in range(n)])


def test_leap_february_rainfall_total():
    _, y, _ = segment([{"month":"2020-02", "value":2}], "2020-02", "2020-02", "PRECTOTCORR")
    assert y.tolist() == [58]


def test_gap_latest_segment_no_interpolation():
    rows = [{"month":"2020-01","value":1},{"month":"2020-02","value":-999},{"month":"2020-03","value":3},{"month":"2020-04","value":4}]
    _, y, info = segment(rows,"2020-01","2020-05","T2M")
    assert y.tolist() == [3,4]
    assert info["excludedEarlierValidMonths"] == 1
    assert info["excludedEndingMonths"] == 1
    assert info["missingMonths"] == ["2020-02","2020-05"]


def test_baseline_repeats_last_cycle_per_lead():
    y = np.arange(36)
    assert baseline(y,35,1) == 24
    assert baseline(y,35,12) == 35
    assert baseline(y,35,13) == 24
    assert baseline(y,35,24) == 35


def test_features_and_labels_have_no_future_leakage():
    y = np.arange(180,dtype=float)
    idx = list(range(24000,24180))
    changed = y.copy(); changed[61:] = 9999
    assert features(y,60,24,idx) == features(changed,60,24,idx)
    f = features(y,60,24,idx)
    assert f[:5] == [60,59,58,55,49]
    assert f[5] == 59
    assert f[9] == 54.5
    for lead in (1,3,12,24):
        assert max(training_origins(60,lead))+lead == 60
        assert len(training_origins(60,lead)) >= 26


@pytest.mark.parametrize("param,value,expected", [("T2M",-7,-7),("PRECTOTCORR",-7,0),("WS10M",-7,0),("RH2M",130,100),("RH2M",-2,0)])
def test_physical_point_bounds(param,value,expected):
    assert postprocess(value,param) == expected
    low,high = bounds(expected,10,param)
    assert low <= expected <= high
    if param in ("PRECTOTCORR","WS10M","RH2M"):
        assert low >= 0
    if param == "RH2M":
        assert high <= 100


def test_quantile_exact_rank_and_interval_nesting():
    errors=list(range(24))
    assert quantile(errors,0.8) == 19
    assert quantile(errors,0.9) == 22
    assert quantile(errors,0.95) == 23
    assert bounds(50,quantile(errors,0.8),"T2M")[0] >= bounds(50,quantile(errors,0.95),"T2M")[0]
    with pytest.raises(ValueError,match="Insufficient calibration"):
        quantile([1]*18,0.95)


def test_insufficient_samples_rejected_and_cap_counts():
    with pytest.raises(ValueError,match="only 120 remain"):
        forecast(request(n=120))
    with pytest.raises(ValueError,match="requires 212 contiguous"):
        forecast(request(h=24,n=180))


def test_undefined_denominators_and_negative_skill():
    rows=[dict(observed=3,prediction=1,baseline=2,scale=2,lower=0,upper=4)]
    result=metrics(rows)
    assert result["skill"] == -100
    assert result["mase"] == 1
    assert result["coverage"] == 1
    rows[0].update(baseline=3,scale=0,lower=0,upper=2)
    result=metrics(rows)
    assert result["skill"] is None and result["mase"] is None
    assert result["coverage"] == 0


def test_full_chronological_pipeline_and_month_alignment():
    r=forecast(request())
    assert r["forecastStart"] == "2015-01"
    assert r["forecastEnd"] == "2015-03"
    assert r["selectedModel"] == "seasonal_naive"
    assert len(r["backtest"]) == 72
    blocks=r["blocks"]
    assert blocks["validation"]["targetEnd"] < blocks["calibration"]["targetStart"]
    assert blocks["calibration"]["targetEnd"] < blocks["test"]["targetStart"]
    for name,b in blocks.items():
        assert b["errorsPerLead"] == 24
        assert b["minimumTrainingSamples"] >= 36
        assert b["firstOrigin"] < b["targetStart"]
    for row in r["backtest"]:
        assert row["origin"] < row["target"]
        assert blocks["test"]["targetStart"] <= row["target"] <= blocks["test"]["targetEnd"]
    assert all(m["count"] == 24 for m in r["metrics"]["perLead"])
    coverage=sum(p["lower"] <= p["observed"] <= p["upper"] for p in r["backtest"])/72
    assert r["metrics"]["overall"]["coverage"] == coverage
    r80=forecast(request(level=0.8))
    for narrow,wide in zip(r80["predictions"],r["predictions"]):
        assert wide["prediction"] == narrow["prediction"]
        assert wide["lower"] <= narrow["lower"] <= narrow["upper"] <= wide["upper"]


def test_final_test_cannot_change_selection_or_calibration():
    req=request(h=1,model="auto",n=144)
    r=forecast(req)
    test_start=r["blocks"]["test"]["targetStart"]
    for observation in req["observations"]:
        if observation["month"] >= test_start:
            observation["value"] += 30
    changed=forecast(req)
    assert changed["selectedModel"] == r["selectedModel"]
    assert changed["validationMae"] == r["validationMae"]
    assert changed["metrics"]["perLead"][0]["calibrationQuantile"] == r["metrics"]["perLead"][0]["calibrationQuantile"]
    assert changed["metrics"]["overall"]["mae"] != r["metrics"]["overall"]["mae"]


def test_api_auth_validation_and_real_job(monkeypatch):
    import time
    monkeypatch.setenv("FORECAST_SERVICE_TOKEN","test-only-token")
    client=TestClient(app)
    assert client.post("/jobs",json=request()).status_code == 401
    headers={"Authorization":"Bearer test-only-token"}
    bad=request();bad["horizon"]=25
    assert client.post("/jobs",json=bad,headers=headers).status_code == 422
    bad=request();bad["level"]=0.99
    assert client.post("/jobs",json=bad,headers=headers).status_code == 422
    bad=request();bad["latitude"]=91
    assert client.post("/jobs",json=bad,headers=headers).status_code == 422
    response=client.post("/jobs",json=request(h=1),headers=headers)
    assert response.status_code == 200
    id=response.json()["id"]
    for _ in range(100):
        job=client.get(f"/jobs/{id}",headers=headers).json()
        if job["status"] not in ("queued","running"):
            break
        time.sleep(0.1)
    assert job["status"] == "completed"
    assert job["result"]["metrics"]["overall"]["count"] == 24
