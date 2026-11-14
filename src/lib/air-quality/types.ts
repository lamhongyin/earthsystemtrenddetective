export type AirHour = { intervalStart: string; intervalEnd: string; originalTime: string; pm25: number | null };
export type AirWindow = { start: string; end: string; validHours: number; meanPm25: number | null; truncatedPm25: number | null; aqi: number | null; aboveScale: boolean; category: string | null };
export type AirResult = {
  source: "NASA GEOS-CF"; dataType: "forecast"; modelVersion: string; collection: string;
  snapshotId: string; initializedAt: string | null; retrievedAt: string; sourceUrl: string;
  sourceObjects: Record<string, string | null>; requestedPoint: { latitude: number; longitude: number }; gridPoint: { latitude: number; longitude: number };
  variable: string; variableDefinition: string; surfaceLayer: number; unit: string; originalUnit: string; conversionFactor: number;
  indexStandard: string; indexScope: string; completenessPolicy: string; temporalDefinition: string; documentation: string;
  coverageStart: string; coverageEnd: string; requestedHours: number; availableFutureHours: number;
  forecastWindowStart: string; forecastWindowEnd: string; hours: AirHour[]; windows24h: AirWindow[]; daily: AirWindow[]; warnings: string[];
};