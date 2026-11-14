// Ports of scipy.stats.linregress, kendalltau (tau-b, method="auto"), and theilslopes (method="separate").
export type TrendDirection = "increasing" | "decreasing" | "approximately stable";
export type TrendStats = {
  predicted: number[]; linearSlope: number; linearIntercept: number; rSquared: number;
  kendallTau: number; pValue: number; senSlope: number; senCiLow: number; senCiHigh: number;
  autocorr: number | null; significant: boolean; direction: TrendDirection;
};

const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
export const popStd = (a: number[]) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length); };

export function linregress(x: number[], y: number[]) {
  const mx = mean(x), my = mean(y);
  let sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < x.length; i++) { const dx = x[i]! - mx, dy = y[i]! - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  const slope = sxy / sxx;
  let r = sxx === 0 || syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy);
  r = Math.max(-1, Math.min(1, r));
  return { slope, intercept: my - slope * mx, rvalue: r };
}

export function pearson(a: number[], b: number[]) {
  const ma = mean(a), mb = mean(b);
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < a.length; i++) { sab += (a[i]! - ma) * (b[i]! - mb); saa += (a[i]! - ma) ** 2; sbb += (b[i]! - mb) ** 2; }
  return sab / Math.sqrt(saa * sbb);
}

function tieCounts(a: number[]) {
  const m = new Map<number, number>();
  for (const v of a) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.values()];
}
function tieStats(a: number[]) {
  let t0 = 0, t1 = 0, t2 = 0;
  for (const c of tieCounts(a)) { t0 += (c * (c - 1)) / 2; t1 += c * (c - 1) * (c - 2); t2 += c * (c - 1) * (2 * c + 5); }
  return [t0, t1, t2];
}
function factorial(n: number) { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; }

function kendallPExact(n: number, c: number): number {
  if (n <= 2) return 1;
  if (c === 0) return n < 171 ? 2 / factorial(n) : 0;
  if (c === 1) return n < 172 ? 2 / factorial(n - 1) : 0;
  if (2 * c === (n * (n - 1)) / 2) return 1;
  let arr = new Array(c + 1).fill(0);
  arr[0] = 1; arr[1] = 1;
  for (let j = 3; j <= n; j++) {
    const cum: number[] = []; let s = 0;
    for (const v of arr) { s += v; cum.push(s); }
    if (j <= c) { const next = cum.slice(); for (let k = j; k <= c; k++) next[k] = cum[k]! - cum[k - j]!; arr = next; } else arr = cum;
  }
  const p = (2 * arr.reduce((t, v) => t + v, 0)) / factorial(n);
  return Math.min(1, Math.max(0, p));
}

// More precise erfc via continued fraction / series for p-values
function erfcPrecise(x: number): number {
  if (x < 0) return 2 - erfcPrecise(-x);
  if (x < 2.5) {
    // erf series
    let sum = x, term = x; const x2 = x * x;
    for (let n = 1; n < 200; n++) { term *= -x2 / n; const add = term / (2 * n + 1); sum += add; if (Math.abs(add) < 1e-17 * Math.abs(sum)) break; }
    return 1 - (2 / Math.sqrt(Math.PI)) * sum;
  }
  // Lentz continued fraction
  let f = x, C = x, D = 0; const tiny = 1e-300;
  for (let n = 1; n < 300; n++) {
    const a = n / 2;
    D = x + a * D; if (D === 0) D = tiny; D = 1 / D;
    C = x + a / C; if (C === 0) C = tiny;
    const delta = C * D; f *= delta; if (Math.abs(delta - 1) < 1e-16) break;
  }
  return Math.exp(-x * x) / (f * Math.sqrt(Math.PI));
}

export function kendalltau(x: number[], y: number[]) {
  const n = x.length;
  let con = 0, dis = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const s = Math.sign(x[j]! - x[i]!) * Math.sign(y[j]! - y[i]!);
    if (s > 0) con++; else if (s < 0) dis++;
  }
  const tot = (n * (n - 1)) / 2;
  const [xt0, xt1, xt2] = tieStats(x) as [number, number, number];
  const [yt0, yt1, yt2] = tieStats(y) as [number, number, number];
  if (xt0 === tot || yt0 === tot) return { tau: NaN, p: NaN };
  const cmd = con - dis;
  const tau = Math.max(-1, Math.min(1, cmd / Math.sqrt(tot - xt0) / Math.sqrt(tot - yt0)));
  let p: number;
  if (xt0 === 0 && yt0 === 0 && (n <= 33 || Math.min(dis, tot - dis) <= 1)) {
    p = kendallPExact(n, Math.min(dis, tot - dis));
  } else {
    const m = n * (n - 1);
    const v = (m * (2 * n + 5) - xt2 - yt2) / 18 + (2 * xt0 * yt0) / m + (xt1 * yt1) / (9 * m * (n - 2));
    p = erfcPrecise(Math.abs(cmd) / Math.sqrt(v) / Math.SQRT2);
  }
  return { tau, p };
}

const median = (s: number[]) => { const n = s.length, h = Math.floor(n / 2); return n % 2 ? s[h]! : (s[h - 1]! + s[h]!) / 2; };
// Python's round(): half to even
export function pyRound(v: number) { const f = Math.floor(v), d = v - f; if (d > 0.5) return f + 1; if (d < 0.5) return f; return f % 2 === 0 ? f : f + 1; }
const Z_975 = 1.959963984540054; // -norm.ppf(0.025)

export function theilslopes(y: number[], x: number[]) {
  const slopes: number[] = [];
  for (let i = 0; i < x.length; i++) for (let j = 0; j < x.length; j++) { const dx = x[i]! - x[j]!; if (dx > 0) slopes.push((y[i]! - y[j]!) / dx); }
  slopes.sort((a, b) => a - b);
  const med = median(slopes);
  const ny = y.length, nt = slopes.length;
  const tieSum = (a: number[]) => tieCounts(a).filter((k) => k > 1).reduce((s, k) => s + k * (k - 1) * (2 * k + 5), 0);
  const sigsq = (ny * (ny - 1) * (2 * ny + 5) - tieSum(x) - tieSum(y)) / 18;
  const sigma = Math.sqrt(sigsq);
  const Ru = Math.min(pyRound((nt + Z_975 * sigma) / 2), nt - 1);
  const Rl = Math.max(pyRound((nt - Z_975 * sigma) / 2) - 1, 0);
  return { slope: med, low: slopes[Rl]!, high: slopes[Ru]! };
}

export function analyzeAnnual(years: number[], values: number[], alpha = 0.05): TrendStats {
  if (years.length < 8) throw new Error("At least eight complete years are required for this demo analysis.");
  if (popStd(values) <= 1e-12) throw new Error("The data are nearly constant; a meaningful trend cannot be estimated.");
  const reg = linregress(years, values);
  const { tau, p } = kendalltau(years, values);
  const sen = theilslopes(values, years);
  const predicted = years.map((x) => reg.intercept + reg.slope * x);
  const res = values.map((v, i) => v - predicted[i]!);
  let autocorr: number | null = null;
  if (res.length >= 4 && popStd(res.slice(0, -1)) > 1e-12 && popStd(res.slice(1)) > 1e-12) {
    const c = pearson(res.slice(0, -1), res.slice(1));
    autocorr = Number.isFinite(c) ? c : null;
  }
  return {
    predicted, linearSlope: reg.slope, linearIntercept: reg.intercept, rSquared: reg.rvalue ** 2,
    kendallTau: tau, pValue: p, senSlope: sen.slope, senCiLow: sen.low, senCiHigh: sen.high,
    autocorr, significant: p < alpha,
    direction: sen.slope > 0 ? "increasing" : sen.slope < 0 ? "decreasing" : "approximately stable",
  };
}
