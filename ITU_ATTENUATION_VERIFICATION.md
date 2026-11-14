# Monthly CCDF and ITU engineering dependency

## Implemented
- Strict empirical monthly survival: ties grouped, numerical thresholds, valid zeros retained, negative/missing/nonfinite totals excluded, maximum tail exactly zero.
- Immutable submitted monthly results; comparison curves use only valid common months after existing geographic checks. Calendar-month filter, linear/log display, exact threshold evaluation and provenance-bearing CSV.
- Separate engineering section with honest unavailable-data state, model-specific input validation and submitted request export. No outputs implied by a request export.
- Pure P.838-3 coefficient, P.618-14 §2.2.1.1, P.530-19 §2.4.1/§2.4.2.1 and WGS84 GEO numerical helpers. These are not a completed spatial feature.

## Official sources acquired and inspected
- https://www.itu.int/dms_pubrec/itu-r/rec/p/R-REC-P.837-8-202509-I!!ZIP-E.zip
  - Archive SHA-256: d56a525fea283205ff478f55476d40ea55436adf51d3042c1533cd4e0626bc85.
  - R001.TXT: 1441 × 2881, latitude south-to-north −90…90, longitude −180…180, 0.125°; duplicate longitude seam included; mm/h, observed range 0…161.191.
  - Source field SHA-256: 360cc6fa81df0403ba00a881cc2e0d58cd67123187dd3244f79273bdb330e553.
  - Checked nodes (2°N, 102°E): 96.472 mm/h; (2°N, 104°E): 106.508 mm/h.
  - P.837-8 Annex 1 states GPCC V2015 land 1951–2000 and ERA Interim water 1979–2014. Bilinear interpolation is prescribed. These are not the monthly NASA study dates.
- https://www.itu.int/dms_pubrec/itu-r/rec/p/R-REC-P.839-4-201309-I!!ZIP-E.zip
  - Archive SHA-256: 0e16ce47866ce3131ccfcd52a8a37877faa5323ceaf486f136e95c2d1ddeb611.
  - h0.txt: 121 × 241, north-to-south 90…−90, longitude 0…360, 1.5°, km ASL. Rain height = h0 + 0.36 km; bilinear interpolation prescribed.
  - Source field SHA-256: a94d7369568786fdc6de57eeddadab59202878cb415c882428b9b8230813cac3.
  - Checked node 1.5°N,103.5°E: h0=4.604 km ASL.

## Specific blocker
ITU recommendations state all rights reserved and reproduction requires written permission. ITU website terms also prohibit modification, distribution and derivative works without prior written permission:
https://www.itu.int/en/about/Pages/terms-of-use.aspx

No evidence of redistribution permission was supplied or found in the supplements. Downloaded originals remain temporary investigation files, NOT public project assets. No synthetic replacement or copied climatology is shipped. Written authorization or an explicitly licensed official distribution is required before preparing public browser assets.

## Numerical evidence
- Independent official workbook CG-3M3J-13-ValEx-Rev8.3.0.xlsx, sheet P.618-14 A_Rain rows 23/26/32: exact supplied R0.01 and hR used solely as test inputs. gamma=1.58130839366869 dB/km, LE=4.29901737938415 km, A0.01=6.79807226654774 dB, A1=0.495317069022985 dB, A0.1=2.18584742205216 dB, A0.001=14.8998224790914 dB; tolerance 5e−10 absolute via 9-place assertions.
- Workbook URL: https://www.itu.int/en/ITU-R/study-groups/rsg3/rwp3m/Validation%20Example/CG-3M3J-13-ValEx-Rev8.3.0.xlsx
- P.530-19 equations 32–36 independently evaluated with Python scalar arithmetic and P.838 Table 5 rounded k/alpha, for horizontal 18 GHz, 10 km, R=100 mm/h: A0.01=52.93929779695887 dB, A0.1=19.980237815617418 dB. Absolute tolerances 0.02/0.01 dB account for table-rounding, not a same-function fixture. No old P.530 revision used as reference.
- Tests cover percentage/frequency limits, internal equation32 bounds, strict p=.01 anchoring, zero/missing rainfall, low elevation, polarization, GEO visibility and wet-snow masking.

## Not complete
No filled contours, map grids, point curves, map margin, endpoint investigation, published spatial manifest or spatial exports. No scientific map claim is made. After permission, implement verified compact asset preparation, interpolation/seam tests, worker/grid, contours, geometry controls and spatial exports, then independently validate actual visitor flows. No new Python backend, paid resource or publication.
## Visitor verification
All 194 tests pass. Fresh browser loaded genuine IMERG demonstration: N=240, 241 exported thresholds including zero, strict maximum tail zero. January uses N=20, 5% increments; threshold 200 mm gives 9/20=45%. Log display omits only zero. Period edits preserve original submitted CCDF. Satellite p=2% accepted; switching to terrestrial rejects retained p=2%. Calculation and submitted-request export disclose unavailable inputs. Desktop charts are side-by-side; 390px mobile stacks without horizontal overflow. No page errors. Latest preview build OK.
