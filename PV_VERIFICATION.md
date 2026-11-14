# PV Energy Yield verification

- Model: horizontal-constant-pr-v1; NASA POWER ALLSKY_SFC_SW_DWN, community RE; canonical kWh/m²/day. Period controls 1984–2025; live verification used 2005–2024.
- Monthly electricity = capacity × canonical GHI × calendar days × assumed PR / 100. Reference irradiance 1 kW/m²; no extra efficiency or loss factors.
- Required fixtures passed: February 2024 464 kWh; February 2023 448 kWh; annual 2024 5856 kWh and 1171.2 kWh/kWp; annual 2023 5840 kWh. Capacity doubling, zeros, missing/fill, complete-year rule, invalid inputs, units and common-year gaps tested.
- Live same-origin NASA Johor Bahru 2005-01: GHI 4.6226 × 31 days × 5 kWp × 0.8 = 573.2024 kWh; independent browser-export arithmetic matched.
- Johor Bahru 2024, 5 kWp, 80% PR: 6582.3168 kWh/year, displayed 6582.3; mean 2005–2024 6680.9 kWh/year, 20 complete years.
- Doubling capacity to 10 kWp doubled exported annual energy exactly. Draft control change displayed stale warning before submission.
- Shared A/B comparison with London: 20 common complete years. JSON, monthly, annual and comparison CSV downloaded through UI. Both locations use submitted identical settings.
- 100 project tests passed, including 14 new PV tests. Automatic checks reported build OK.
- Desktop and 390px browser checks: no horizontal page overflow, no page errors.
- Advanced tilt/orientation, tracking, floating cooling and explicit thermal/inverter simulation unavailable. No new services or credentials. No publication requested.
