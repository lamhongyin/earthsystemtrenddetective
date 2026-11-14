// Schematic display positions only: never scientific measurements or model output.
export const FISH_ILLUSTRATION = {
  layerId: "artificial-fish-illustration-v1",
  dataRole: "artificial_illustration",
  isPrediction: false,
  isObservedFishData: false,
  environmentalContextMonth: "2024-01",
  description: "Schematic fish symbols; no fish observations or predictive model",
  positions: [{ lat: 2.5, lon: 105 }, { lat: 3.5, lon: 106 }, { lat: 4.5, lon: 107 }, { lat: 5.5, lon: 109 }, { lat: 1.5, lon: 106 }],
} as const;
export const FISH_TOOLTIP = "Artificial fish symbol placed for demonstration; no observed or predicted fish population is represented.";
export type OceanViewport = { lat: number; lon: number; zoom: number };