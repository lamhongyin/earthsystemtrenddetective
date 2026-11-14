import { csvRows, safePlaceText } from "@/lib/trend/csv";
import type { ForecastResult } from "./types";
export function forecastCsv(r: ForecastResult, label: string) {
  return csvRows([["location", "latitude", "longitude", "parameter", "unit", "training_end", "target_month", "lead", "prediction", "lower", "upper", "interval_level", "model"], ...r.predictions.map(p => [safePlaceText(label), r.settings.latitude, r.settings.longitude, r.settings.parameter, unit(r.settings.parameter), r.observedEnd, p.month, p.lead, p.prediction, p.lower, p.upper, p.level, r.selectedModel])]);
}
export const unit = (code: string) => ({ T2M: "°C", PRECTOTCORR: "mm/month", RH2M: "%", WS10M: "m/s", ALLSKY_SFC_SW_DWN: "kWh/m²/day" })[code] ?? "";
export const backtestCsv = (r: ForecastResult) => csvRows([["origin", "target_month", "lead", "observed", "prediction", "baseline_prediction", "lower", "upper"], ...r.backtest.map(p => [p.origin, p.target, p.lead, p.observed, p.prediction, p.baseline, p.lower, p.upper])]);
export const metricsCsv = (r: ForecastResult) => csvRows([["lead", "count", "MAE", "RMSE", "MASE", "baseline_MAE", "MAE_skill_percent", "coverage", "mean_interval_width"], ...[{ lead: "overall", ...r.metrics.overall }, ...r.metrics.perLead].map(m => [m.lead, m.count, m.mae, m.rmse, m.mase, m.baselineMae, m.skill, m.coverage, m.width])]);
