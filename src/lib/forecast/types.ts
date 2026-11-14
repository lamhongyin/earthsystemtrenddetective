export type ForecastModel = "auto" | "seasonal_naive" | "gradient_boosted";
export type ForecastSettings = { parameter: "T2M" | "PRECTOTCORR" | "RH2M" | "WS10M" | "ALLSKY_SFC_SW_DWN"; latitude: number; longitude: number; start: string; end: string; horizon: number; level: 0.8 | 0.9 | 0.95; model: ForecastModel };
export type ForecastRequest = ForecastSettings & { observations: { month: string; value: number }[]; provenance: Record<string, unknown> };
export type ForecastMetric = { count: number; mae: number; rmse: number; mase: number | null; baselineMae: number; skill: number | null; coverage: number; width: number };
export type ForecastPrediction = { month: string; lead: number; prediction: number; lower: number; upper: number; level: number };
export type BacktestRow = { origin: string; target: string; lead: number; observed: number; prediction: number; baseline: number; lower: number; upper: number; scale: number };
export type ForecastResult = {
  settings: ForecastSettings & { provenance: Record<string, unknown> }; selectedModel: Exclude<ForecastModel, "auto">;
  history: { month: string; value: number }[]; observedEnd: string; forecastStart: string; forecastEnd: string; observationAgeMonths: number;
  predictions: ForecastPrediction[]; backtest: BacktestRow[]; validationMae: Record<string, number>;
  metrics: { overall: ForecastMetric; perLead: (ForecastMetric & { lead: number; calibrationQuantile: number })[] };
  data: { retainedStart: string; retainedEnd: string; retainedMonths: number; excludedEarlierValidMonths: number; excludedEndingMonths: number; missingMonths: string[] };
  blocks: Record<string, { targetStart: string; targetEnd: string; firstOrigin: string; lastOrigin: string; errorsPerLead: number; minimumTrainingSamples: number }>;
  warnings: string[]; clipping: Record<string, number>; reproducibility: Record<string, unknown>;
};
export type ForecastJob = { id: string; status: "queued" | "running" | "completed" | "failed" | "cancelled"; stage?: string; error?: string; result?: ForecastResult };
