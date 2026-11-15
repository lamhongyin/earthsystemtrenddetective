# Earth System Trend Detective

**Team:** UTHMSPACE  
**Event:** NASA Space Apps Challenge 2026  
**Challenge:** Be An Earth System Trend Detective!  
**Application:** [earthsystemtrenddetective.lovable.app](https://earthsystemtrenddetective.lovable.app/)  
**Documentation date:** 15 November 2026, Malaysia time

Earth System Trend Detective helps students, educators and communities investigate **what is changing, where it is changing, how quickly it is changing, and how strong the evidence is**. It connects NASA environmental records with local comparisons, worldwide maps and practical demonstrations involving rainfall, ocean conditions, air quality, solar energy and communication links.

This documentation describes reviewed source commit `ad78f8b4f658b9468fae97b4c0e8b337e6ac7687` and the latest recorded demonstrations. A published application can differ from the reviewed source until its latest changes are deployed. Demonstration numbers below are dated examples, not newly measured conditions or a guarantee that an external service is currently available.

## Why we built it

A global average can conceal different regional trends. A warming location, a drying region and an area with little detectable change require different interpretations. Environmental archives also contain different units, spatial scales, time intervals and levels of uncertainty.

Our contribution is an integrated investigation workflow that makes these differences visible. Users can start with a familiar place, inspect the data, compare another place, explore the global pattern and download the evidence. The project applies established scientific methods; it does not claim to invent linear regression, Mann–Kendall testing, Sen’s slope or gradient boosting.

## Application modules

| Module | What users can investigate | Current scope |
| --- | --- | --- |
| Historical analysis | Temperature, corrected precipitation, humidity, wind and solar resource from NASA POWER | Monthly records, complete-year summaries, OLS and Sen slopes, preliminary Kendall trend evidence |
| Location A/B comparison | Differences between two selected locations | Statistics recalculated over their common complete years |
| Worldwide spatial explorer | Geographic patterns in values, means and trends | Source-grid displays; prepared 2005–2024 period means and Sen slopes |
| Hotspots | Relatively strong warming, drying or their intersection | Area-weighted OLS ranking and connected candidate areas; descriptive screening |
| Rainfall investigation | GPM IMERG monthly precipitation, climatology and exceedance | Genuine Giovanni sample: 240 months, January 2005–December 2024, 102–104°E and 1–3°N; reviewed CSV imports |
| Rain attenuation | Rain-only attenuation for satellite and hypothetical terrestrial links | ITU-R climatology and propagation models, scenario maps, point values and exceedance curves |
| Short-interval rainfall research | Exploratory relationships between half-hourly and finer-interval rainfall distributions | Local file workflow exists; real paired IMERG/gauge validation is still missing |
| Fisheries environment | Side-by-side SST and chlorophyll-a context | Real January 2024 MODIS Aqua data; artificial fish icons with a visibility toggle |
| Monthly forecasting | Predictions from a seasonal benchmark or gradient-boosted regression | Separate Python service; chronological validation, calibration and testing |
| Air quality | NASA GEOS-CF modelled PM2.5 and derived PM2.5 AQI estimates | Dated model forecasts; service-dependent; not Malaysia’s official API/IPU |
| PV energy yield | Electricity scenarios based on NASA POWER solar resource | Constant capacity and performance ratio on a horizontal-resource basis |

## Suggested demonstration

1. Open the application and select **Johor Bahru**, temperature, and **2005–2024**.
2. Inspect the monthly observations, annual summaries, trend magnitude and uncertainty.
3. Add **London** and compare the common complete years.
4. Explore the worldwide Sen-slope map, then use Hotspots to investigate relative warming or drying.
5. Load the supplied IMERG rainfall demonstration and examine a monthly CCDF threshold.
6. Show one application: fisheries environmental context, a PV scenario, or a rain-attenuation scenario.
7. Export the selected evidence with its source, units, location, period and settings.

Place search can require authentication. Coordinate entry and presets provide an alternative investigation route. Some prepared assets load asynchronously; wait for the data status before interpreting an empty map.

## Recorded examples

| Investigation | Recorded result | Interpretation |
| --- | --- | --- |
| Johor Bahru temperature, 2005–2024 | Sen slope about +0.038 °C/year; 95% interval about +0.016 to +0.059; p ≈ 0.0024 | Preliminary evidence of an increasing trend under the test assumptions |
| London temperature, same common years | Sen slope about +0.044 °C/year; interval crosses zero; p ≈ 0.0548 | A positive estimate with weaker evidence at the 0.05 threshold |
| IMERG monthly depth above 500 mm | 1 of 240 months: 0.4167% | Fraction of sampled months, not one-minute rainfall exceedance |
| Satellite rain attenuation at 2°N, 103°E | About 53.0846 dB at 20 GHz, horizontal polarization, 30° elevation, p = 0.01% | Long-term rain-only model scenario |
| Johor temperature forecast demonstration | MAE 0.521 °C; seasonal-baseline MAE 0.567 °C; reported skill 8.1% | Historical rolling-origin performance; nominal 95% interval coverage was only 83.3% |
| Johor PV scenario, 2024 | About 6,582.3 kWh for 5 kWp and 80% performance ratio | Simplified horizontal-resource scenario, not measured generation |

The forecast example uses a December 2024 training cutoff and January–March 2025 prediction dates. These are retrospective dates relative to this documentation. The two location slopes are descriptive comparisons; the app does not formally test whether they differ.

## Technology and architecture

The application uses React, TypeScript, TanStack Start/Router/Query, Tailwind CSS, Recharts, Google Maps/Places and Leaflet/OpenStreetMap. TypeScript modules implement the historical statistics, rainfall calculations, PV scenarios and browser-based engineering calculations.

Python performs scientific data preparation and the separately hosted forecasting/GEOS-CF work. Prepared spatial and ocean assets retain manifests and checksums. The forecast backend uses FastAPI and scikit-learn, with server-side proxies keeping its credential out of the browser. Visitors do not need a continuously running laptop to use a configured hosted deployment.

Useful source locations:

| Concern | Repository path |
| --- | --- |
| Historical statistics and parsing | `src/lib/trend/` |
| Spatial layers and hotspot screening | `src/lib/spatial/`, `src/lib/hotspots/` |
| Rainfall and attenuation | `src/lib/rainfall/`, `src/lib/attenuation/` |
| Ocean data and illustrations | `src/lib/ocean/`, `public/fisheries/manifest.json` |
| PV calculations | `src/lib/pv/` |
| Forecast and air-quality backend | `services/forecast/` |
| Scientific preparation | `scripts/` |

For a local checkout of the actual project repository:

```sh
npm install
npm run dev
npm test
npm run build
```

These commands describe the project scripts. This documentation package does not contain the application source, source datasets or a configured backend. Backend setup and its pinned dependencies are documented in `services/forecast/README.md`. Do not commit secrets or put service tokens in browser code.

## Scientific limits and open work

- NASA gridded products represent their source support; a map click does not create a weather-station observation, and zooming does not increase measurement resolution.
- Point p-values and Sen intervals remain preliminary where temporal dependence is present. Global maps and hotspot candidates do not establish causation or validated hazard zones.
- Only one ocean month is installed. Fish icons are artificial illustrations and do not predict fish locations, abundance or catch.
- Monthly rainfall cannot directly supply ITU one-minute rain-rate inputs. Attenuation estimates exclude a complete link budget, terrain, obstructions and combined propagation effects.
- A known terrestrial metadata issue can retain the satellite elevation in displayed/exported inclination. The recorded review found the calculation used the antenna-derived inclination; the metadata still needs correction.
- Forecast intervals have imperfect historical coverage. Hosted-service cold starts and restarts can interrupt forecasting and air-quality requests.
- Educational value and technical feasibility are demonstrated. Adoption, decision improvement and economic or environmental impact have not been measured.

Source records report automated checks and selected live demonstrations. The complete application test suite was not rerun while preparing these Markdown files.

## Documentation guide

| File | Contents |
| --- | --- |
| [methodology.md](methodology.md) | Data handling, regression, Kendall/Mann–Kendall interpretation, Sen’s slope, maps and application calculations |
| [nasa-data-sources.md](nasa-data-sources.md) | NASA products, parameters, APIs, installed samples and provenance |
| [machine-learning.md](machine-learning.md) | Forecasting models, chronological evaluation, uncertainty and service architecture |
| [literature-review.md](literature-review.md) | Selected research, existing systems, project positioning and remaining research gaps |

## Credits

NASA provides the environmental products acknowledged in [nasa-data-sources.md](nasa-data-sources.md). ITU-R provides the separate propagation references. Mapping uses Google Maps and [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), with the applicable on-screen attribution.

ChatGPT and Lovable assisted ideation, research, interface design, code, debugging, data preparation and writing. The project team remains responsible for source attribution, scientific interpretation and final content. Third-party datasets, services and software retain their own terms; this documentation does not declare a new license for them or for the repository.
