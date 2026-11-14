"""Direct monthly forecasting, expanding origins, disjoint target-date blocks."""
import calendar
import math
import platform
from datetime import date
import numpy as np
import sklearn
from sklearn.ensemble import GradientBoostingRegressor

VERSION = "direct-monthly-v1"
CONFIG = dict(n_estimators=40, learning_rate=0.05, max_depth=2, min_samples_leaf=5, loss="squared_error", random_state=42)
MIN_SAMPLES = 36
ERROR_COUNT = 24


def month_index(s):
    return int(s[:4]) * 12 + int(s[5:7]) - 1


def month_string(i):
    return f"{i // 12:04d}-{i % 12 + 1:02d}"


def segment(rows, start, end, parameter):
    """Explicit calendar, no imputation; discard incomplete current/future months."""
    today = date.today()
    last_complete = today.year * 12 + today.month - 2
    first, requested_last = month_index(start), month_index(end)
    last = min(requested_last, last_complete)
    valid = {}
    for row in rows:
        i = month_index(row["month"])
        value = row["value"]
        if first <= i <= last and math.isfinite(value) and value > -900:
            days = calendar.monthrange(i // 12, i % 12 + 1)[1]
            valid[i] = float(value * days if parameter == "PRECTOTCORR" else value)
    if not valid:
        raise ValueError("No complete valid monthly observations in the requested training period.")
    finish = max(valid)
    begin = finish
    while begin - 1 in valid:
        begin -= 1
    indices = list(range(begin, finish + 1))
    missing = [month_string(i) for i in range(first, last + 1) if i not in valid]
    return indices, np.array([valid[i] for i in indices]), {
        "requestedStart": start, "requestedEnd": end,
        "retainedStart": month_string(begin), "retainedEnd": month_string(finish),
        "retainedMonths": len(indices), "excludedEarlierValidMonths": sum(i < begin for i in valid),
        "excludedEndingMonths": requested_last - finish,
        "missingMonths": missing,
    }


def postprocess(value, parameter):
    if parameter in ("PRECTOTCORR", "WS10M"):
        return max(0.0, float(value))
    if parameter == "RH2M":
        return min(100.0, max(0.0, float(value)))
    return float(value)


def bounds(point, q, parameter):
    return postprocess(point - q, parameter), postprocess(point + q, parameter)


def features(y, origin, lead, indices):
    # All data-dependent features end at origin. Target month is calendar-only.
    values = [y[origin - lag] for lag in (0, 1, 2, 5, 11)]
    for size in (3, 6, 12):
        window = y[origin - size + 1:origin + 1]
        values.extend([float(np.mean(window)), float(np.std(window, ddof=0))])
    target = indices[origin] + lead
    angle = 2 * math.pi * (target % 12) / 12
    return values + [math.sin(angle), math.cos(angle), float(origin)]


def baseline(y, origin, lead):
    # Last observed value in the target calendar month; repeats for lead > 12.
    return float(y[origin - ((-lead) % 12)])


def training_origins(cutoff, lead):
    return list(range(11, cutoff - lead + 1))


def fit_predict(y, indices, origin, lead, matrices):
    origins = training_origins(origin, lead)
    if len(origins) < MIN_SAMPLES:
        raise ValueError(f"Lead {lead} needs at least {MIN_SAMPLES} observable training labels.")
    model = GradientBoostingRegressor(**CONFIG)
    model.fit(matrices[lead][origins], y[np.array(origins) + lead])
    return float(model.predict(matrices[lead][origin:origin + 1])[0])


def quantile(errors, level):
    k = math.ceil((len(errors) + 1) * level)
    if k > len(errors):
        raise ValueError(f"Insufficient calibration errors for {level * 100:g}% intervals.")
    return float(sorted(errors)[k - 1])


def metrics(rows):
    errors = np.array([abs(r["observed"] - r["prediction"]) for r in rows])
    base = float(np.mean([abs(r["observed"] - r["baseline"]) for r in rows]))
    scaled = [abs(r["observed"] - r["prediction"]) / r["scale"] for r in rows if r["scale"] > 0]
    mae = float(np.mean(errors))
    return {"count": len(rows), "mae": mae, "rmse": float(np.sqrt(np.mean(errors ** 2))),
            "mase": float(np.mean(scaled)) if len(scaled) == len(rows) else None,
            "baselineMae": base, "skill": 100 * (1 - mae / base) if base > 0 else None,
            "coverage": float(np.mean([r["lower"] <= r["observed"] <= r["upper"] for r in rows])),
            "width": float(np.mean([r["upper"] - r["lower"] for r in rows]))}


def forecast(request, progress=lambda s: None):
    h, level, parameter = request["horizon"], request["level"], request["parameter"]
    indices, y, data_info = segment(request["observations"], request["start"], request["end"], parameter)
    n, length = len(y), ERROR_COUNT + h - 1
    required = max(120, 47 + h + 3 * length)
    if n < required:
        raise ValueError(f"Horizon {h} requires {required} contiguous complete months ({MIN_SAMPLES} training labels and 24 validation, calibration and test errors per lead); only {n} remain. Extend the training period or shorten the horizon.")
    starts = [n - 3 * length, n - 2 * length, n - length]
    matrices = {lead: np.array([features(y, t, lead, indices) if t >= 11 else [0.0] * 14 for t in range(n)]) for lead in range(1, h + 1)}
    blocks, evaluations = {}, {}
    clipped = {"validation": 0, "calibration": 0, "test": 0, "forecast": 0, "intervalBounds": 0}
    selected = request["model"]
    q = {}
    validation_scores = {}
    for name, start in zip(("validation", "calibration", "test"), starts):
        progress(name)
        rows = []
        for origin in range(start - 1, start - 1 + ERROR_COUNT):
            scale = float(np.mean(np.abs(y[12:origin + 1] - y[:origin - 11])))
            for lead in range(1, h + 1):
                base_raw = baseline(y, origin, lead)
                base = postprocess(base_raw, parameter)
                tree_raw = fit_predict(y, indices, origin, lead, matrices) if name == "validation" or selected == "gradient_boosted" else None
                tree = postprocess(tree_raw, parameter) if tree_raw is not None else None
                prediction = tree if selected == "gradient_boosted" else base
                clipped[name] += int(base != base_raw) + int(tree_raw is not None and tree != tree_raw)
                r = {"origin": month_string(indices[origin]), "target": month_string(indices[origin] + lead),
                     "lead": lead, "observed": float(y[origin + lead]), "prediction": prediction,
                     "baseline": base, "tree": tree, "scale": scale}
                if name == "test":
                    low, high = bounds(prediction, q[lead], parameter)
                    clipped["intervalBounds"] += int(low != prediction - q[lead]) + int(high != prediction + q[lead])
                    r.update(lower=low, upper=high)
                rows.append(r)
        blocks[name] = {"targetStart": month_string(indices[start]), "targetEnd": month_string(indices[start + length - 1]),
                        "firstOrigin": month_string(indices[start - 1]), "lastOrigin": month_string(indices[start + ERROR_COUNT - 2]),
                        "errorsPerLead": ERROR_COUNT, "minimumTrainingSamples": len(training_origins(start - 1, h)),
                        "perLead": [{"lead": lead, "targetStart": next(r["target"] for r in rows if r["lead"] == lead),
                                     "targetEnd": [r["target"] for r in rows if r["lead"] == lead][-1], "count": ERROR_COUNT} for lead in range(1, h + 1)]}
        if name == "validation":
            validation_scores = {"seasonal_naive": float(np.mean([abs(r["observed"] - r["baseline"]) for r in rows])),
                                 "gradient_boosted": float(np.mean([abs(r["observed"] - r["tree"]) for r in rows]))}
            if selected == "auto":
                selected = "gradient_boosted" if validation_scores["gradient_boosted"] < validation_scores["seasonal_naive"] else "seasonal_naive"
            for r in rows:
                r["prediction"] = r["tree"] if selected == "gradient_boosted" else r["baseline"]
        if name == "calibration":
            q = {lead: quantile([abs(r["observed"] - r["prediction"]) for r in rows if r["lead"] == lead], level) for lead in range(1, h + 1)}
        evaluations[name] = rows
    progress("refit")
    predictions = []
    for lead in range(1, h + 1):
        raw = fit_predict(y, indices, n - 1, lead, matrices) if selected == "gradient_boosted" else baseline(y, n - 1, lead)
        point = postprocess(raw, parameter)
        low, high = bounds(point, q[lead], parameter)
        clipped["forecast"] += int(raw != point)
        clipped["intervalBounds"] += int(low != point - q[lead]) + int(high != point + q[lead])
        predictions.append({"month": month_string(indices[-1] + lead), "lead": lead, "prediction": point, "lower": low, "upper": high, "level": level})
    test = evaluations["test"]
    overall = metrics(test)
    per_lead = [{"lead": lead, **metrics([r for r in test if r["lead"] == lead]), "calibrationQuantile": q[lead]} for lead in range(1, h + 1)]
    age = max(0, date.today().year * 12 + date.today().month - 1 - indices[-1])
    warnings = ["Experimental statistical forecast based on historical NASA POWER data.",
                "Local univariate monthly aggregates, not daily weather, flood warnings or emissions-scenario climate projections.",
                "Empirical conformal-style intervals: temporal dependence, shifts and refitting mean future coverage is not guaranteed.",
                "Overlapping rolling origins are dependent, not independent experiments; only 24 errors per lead in each block."]
    if overall["skill"] is not None and overall["skill"] < 0:
        warnings.append("Selected model performs worse than the seasonal benchmark on untouched testing.")
    if overall["coverage"] < level:
        warnings.append("Historical test coverage is below the requested nominal interval level.")
    if age > 2:
        warnings.append(f"Last observation is {age} months old; the forecast starts immediately after it, not today.")
    if data_info["excludedEarlierValidMonths"] or data_info["excludedEndingMonths"] or data_info["missingMonths"]:
        warnings.append("Only the latest contiguous complete monthly segment is used; earlier records, gaps and ending months are disclosed below.")
    if any(clipped.values()):
        warnings.append("Physical clipping was applied consistently to predictions and interval bounds; counts are included in reproducibility data.")
    return {"settings": {k: v for k, v in request.items() if k != "observations"}, "data": data_info,
            "history": [{"month": month_string(i), "value": float(v)} for i, v in zip(indices, y)],
            "observedEnd": month_string(indices[-1]), "forecastStart": predictions[0]["month"], "forecastEnd": predictions[-1]["month"],
            "observationAgeMonths": age, "selectedModel": selected, "validationMae": validation_scores,
            "predictions": predictions, "backtest": test, "metrics": {"overall": overall, "perLead": per_lead},
            "blocks": blocks, "warnings": warnings, "clipping": clipped,
            "reproducibility": {"featureVersion": VERSION, "python": platform.python_version(), "sklearn": sklearn.__version__,
                                "numpy": np.__version__, "configuration": CONFIG, "minimumTrainingSamples": MIN_SAMPLES,
                                "originSpacingMonths": 1, "blockLengthMonths": length,
                                "selection": "Validation MAE pooled equally across 24 errors per lead; baseline wins ties; no test tuning.",
                                "features": "Observed lags 0,1,2,5,11; trailing mean/population SD 3,6,12; target month sin/cos; index since retained start.",
                                "training": "At origin t fit each lead h on origins 11..t-h, labels y[origin+h] <= t. Refit within every expanding fold and on all eligible history for inference.",
                                "intervalMethod": "Lead-specific calibration absolute error order statistic k=ceil((n+1)*level); no test residuals used.",
                                "mase": "Mean of test absolute errors divided by each fold's observed training mean |y[t]-y[t-12]|; unavailable if any fold scale is zero.",
                                "postprocessing": "Rainfall/wind >=0; RH in [0,100]; temperature unclipped. Same rules in all blocks and inference.",
                                "blockIsolation": "Target date blocks disjoint; 24 origins per block; length 24+H-1 ensures every lead stays inside its block."}}
