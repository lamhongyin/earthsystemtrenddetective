import { describe, expect, it } from "vitest";
import { bilinear, LOCAL_INPUTS, validateMap, filledBands, type MapScenario, type EvaluatedPoint } from "./local";
import { calculatePoint } from "./model";
const scenario: MapScenario = { link: { mode: "satellite", frequencyGHz: 20, pPercent: .01, polarization: "horizontal", elevationDeg: 30, altitudeKmAsl: 0, distanceKm: 10, antenna1KmAsl: .03, antenna2KmAsl: .03 }, geometry: "reference", orbitalLongitudeDeg: 103, minElevationDeg: 0, extent: { west: 102, east: 104, south: 1, north: 3 }, spacingDeg: .125, intervalDb: 5, marginDb: null };
describe("local-only verified climatology", () => {
 it("pins the supplied original hashes and shapes", () => { expect(LOCAL_INPUTS.rain.hash).toBe("360cc6fa81df0403ba00a881cc2e0d58cd67123187dd3244f79273bdb330e553"); expect(LOCAL_INPUTS.height.hash).toBe("a94d7369568786fdc6de57eeddadab59202878cb415c882428b9b8230813cac3"); expect(LOCAL_INPUTS.rain.rows * LOCAL_INPUTS.rain.cols).toBe(4151521); expect(LOCAL_INPUTS.height.rows * LOCAL_INPUTS.height.cols).toBe(29161); });
 it("bilinearly interpolates south-first rainfall and wraps longitude", () => {
  const a = new Float64Array(LOCAL_INPUTS.rain.rows * LOCAL_INPUTS.rain.cols);
  a[736 * 2881 + 2256] = 96.472; a[736 * 2881 + 2257] = 100; a[737 * 2881 + 2256] = 104; a[737 * 2881 + 2257] = 108;
  expect(bilinear(a,"rain",2,102)).toBe(96.472); expect(bilinear(a,"rain",2,462)).toBe(96.472); expect(bilinear(a,"rain",2.0625,102.0625)).toBeCloseTo(102.118,10);
  a[737 * 2881 + 2257] = NaN; expect(bilinear(a,"rain",2.0625,102.0625)).toBeNull();
 });
 it("uses north-first h0 ordering", () => { const a = new Float64Array(121*241); a[59*241+69]=4.604; expect(bilinear(a,"height",1.5,103.5)).toBe(4.604); expect(bilinear(a,"height",1.5,-256.5)).toBe(4.604); });
 it("bounds cells, extent, spacing and keeps model-specific p limits", () => { expect(validateMap(scenario)).toEqual({}); expect(validateMap({...scenario, spacingDeg:.01})["spacingDeg"]).toBeTruthy(); expect(validateMap({...scenario, extent:{west:0,east:40,south:0,north:40}})["spacingDeg"]).toBeTruthy(); expect(validateMap({...scenario,link:{...scenario.link,pPercent:2}})).toEqual({}); expect(validateMap({...scenario,link:{...scenario.link,mode:"terrestrial",pPercent:2}})["pPercent"]).toBeTruthy(); });
 it("preserves invalid cells as contour holes and includes over-range bands", () => {
  const base=calculatePoint(scenario.link,2,100,5); const pts:EvaluatedPoint[]=[{lat:1,lon:102},{lat:1,lon:103},{lat:2,lon:102},{lat:2,lon:103}].map(p=>({...base,...p,h0KmAsl:4.64,headroomDb:null,apDb:12}));
  const bands=filledBands(pts,2,2,[0,5,10],null);expect(bands.length).toBe(2); expect(bands[0]?.properties.upperDb).toBeNull();
  pts[0]={...pts[0] as EvaluatedPoint,valid:false,apDb:null};expect(filledBands(pts,2,2,[0,5,10],null)).toEqual([]);
 });
});
