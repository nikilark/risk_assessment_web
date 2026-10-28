# Reference-value and calculation review — 2026-10-27

The requested baseline is [MOH Order 184/2007](https://zakon.rada.gov.ua/rada/show/v0184282-07). Its complete official print page was retrieved and checked, including the chronic RfC and inhalation SF appendices. This review adopts that historical baseline, rather than mixing its chronic values with a different modern EPA/OEHHA chronic system. It does not establish that every catalog entry is a current health-based standard.

## The seven project pollutants

All concentrations below are **mg/m³**; SF is **(mg/kg-day)⁻¹**. The acute OEHHA tables publish µg/m³: divide those values by 1000 before comparison with the app's concentration inputs.

| Agent | Chronic benchmark | Acute benchmark | Inhalation SF | Decision and source |
|---|---:|---:|---:|---|
| NO₂ | 0.04 | 0.47 | Not supplied | Chronic unchanged: MOH 2007 appendix. Acute unchanged: [OEHHA NO₂](https://oehha.ca.gov/chemicals/nitrogen-dioxide). |
| SO₂ | 0.08 | 0.66 | Not supplied | Both retained: the linked MOH appendix says **0.08**, not 0.05. Acute: [OEHHA SO₂](https://oehha.ca.gov/chemicals/sulfur-dioxide). A different required chronic value needs a specified alternative benchmark and averaging period. |
| CO | **3** (surrogate) | 23 | Not supplied | Chronic enabled using the downloaded Malyshevska paper, Table 3, journal p.154: [DOI](https://doi.org/10.31393/reports-vnmedical-2021-25(1)-27). This is an MPC-equivalent substitute, permitted by MOH 2007 §4.4.1, **not an EPA RfC**. [ATSDR explicitly notes that EPA has not established a CO RfC](https://www.ncbi.nlm.nih.gov/books/NBK153699/). Acute unchanged: [OEHHA CO](https://oehha.ca.gov/chemicals/carbon-monoxide). |
| H₂S | 0.001 | **0.042** (was 0.1) | Not supplied | Chronic retained from MOH 2007, despite differences from newer reference systems. Acute: 42 µg/m³ and CNS endpoint, [OEHHA H₂S](https://oehha.ca.gov/chemicals/hydrogen-sulfide). |
| Phenol | 0.006 | **5.8** (was 6) | Not supplied | Chronic retained from MOH 2007. Acute: 5800 µg/m³, respiratory/eye endpoints, [OEHHA phenol](https://oehha.ca.gov/chemicals/phenol). |
| Formaldehyde | 0.003 | **0.055** (was 0.048) | 0.046 | Chronic and SF agree with MOH 2007. Acute: 55 µg/m³ and eye endpoint, [OEHHA formaldehyde](https://oehha.ca.gov/chemicals/formaldehyde). OEHHA's separate chronic 0.009 and SF 0.021 are **not** substituted into the chosen MOH baseline. |
| TSP | 0.1 | **0.3 — unverified legacy value** | Not supplied | Chronic 0.1 and respiratory endpoint are in the MOH appendix. The linked document does not provide acute reference concentrations. No matching-duration primary source for the legacy TSP acute value was established in this review. |

“Not supplied” is represented by zero/missing in the existing schema and excludes a substance from the corresponding cancer calculation; it is not evidence of zero health risk.

The CO surrogate is identified in agent `referenceNotes`, comparison method notes, and the report methodology. Verified parameter source, unit, and basis are saved in `parameterSources`.

## Broader catalog audit

The compact catalog contains 33 substances; the expanded catalog contains 387. CAS-based comparison against the MOH appendices found 6 chronic RfC and 3 SF scale errors in the compact catalog. Across the expanded catalog, **28 chronic RfC and 45 SF fields** were exactly 1000-fold higher than their printed reference values. Those 73 distinct fields were corrected, with the overlapping compact entries corrected as well.

Examples:

- Acrylonitrile RfC: 2 → **0.002**.
- Acetaldehyde RfC: 9 → **0.009**.
- Vinyl chloride RfC: 5 → **0.005**.
- Epichlorohydrin RfC: 1 → **0.001**.
- Tetrachloroethylene RfC: 35 → **0.035**, SF: 2 → **0.002**.
- Chloroform RfC: 98 → **0.098**, SF: 81 → **0.081**.
- Benzene SF: 27 → **0.027**.

The unmodified historical input `research.json` remains available. `web/src/data/reference-overrides.json` records the sourced corrections and is applied by `tools/catalog-audit.mjs`, so regenerating catalogs preserves them. IDs, names, and CAS identifiers were preserved.

`reference_audit_2026-10-27.json` records the before-review comparison counts, all scale corrections, and unresolved zero/nonzero matches. CAS-only matching does not establish that grouped substances, mixtures, or suspicious aliases are interchangeable. Missing zero values and such identity questions were **not** auto-filled. The existing audit still identifies nine invalid CAS values; this review is not an exhaustive chemical-identity cleanup. Unmatched values are unverified, rather than confirmed correct. Acute references beyond the six project gases were not revalidated.

## Formula review

- **HQ = C/RfC** agrees with MOH 2007 §4.4.1. Concentrations and reference values must share units **and averaging duration**. The app currently shares one entered concentration between acute and chronic scenarios; annual means cannot automatically be treated as one-hour maxima.
- **HI = ΣHQ** agrees structurally. Organ-specific sums are the appropriate comparison for shared target systems; a total across unrelated systems is a conservative screening sum. The app's five display bands are not the MOH 2007 table, which distinguishes HQ <1, =1, >1.
- **CR = LADD × SF**, additive cancer risk, and **PCR = CR × population** agree with MOH 2007 §4.4.2. SF must be dose-based in (mg/kg-day)⁻¹; an inhalation unit risk per concentration is not a drop-in replacement.
- The app's 6/12/52-year LADD calculation is a specific scenario, not a parameter set prescribed by this document. It fits the dose equation only under its stated breathing-rate, body-weight, 350-day exposure, and shared concentration assumptions. The document's equation explicitly allows different indoor and outdoor exposures; those are not separate app inputs.
- The app's “acute cancer” option still uses a lifetime duration. The linked document does not validate that label/scenario. Both cancer options are enabled in the supplied project; those user-selected flags are preserved. With population still set to zero placeholders, population cancer totals are not valid population estimates. No unsupported replacement exposure scenario was invented.
- The diploma particle mortality calculation, its concentration scale, and its five risk bands are **not validated by MOH 2007**. This review does not change those formulas. TSP → PM10 = 0.6 × TSP remains confined to the existing mortality calculation, not applied to the input concentrations or TSP HQ.
- The printed NO₂ example contains an arithmetic inconsistency: 0.099 / 0.04 is **2.475**, not 2.472. The code retains correct arithmetic.

The 2023 [MOH 1811 recommendations](https://moz.gov.ua/uploads/10/50566-dn_1811_18102023_met_rek.pdf), §III.16, also support the dose/SF and population-risk structure, but use a stated adult scenario; citing them does not validate every app-specific scenario.

## Updated user file

`~/Downloads/project.json` now selects TSP instead of PM10. All 66 PM observations point to the existing TSP agent ID; all **462 numerical concentrations**, years, object coordinates, population, and death counts are unchanged. PM10 remains available in the catalog but is not selected. The project's assumptions, pollutant mapping, reference metadata, and imported report notes were updated consistently. Population/death placeholders and the original uncertainty about units/averaging duration remain documented.

A byte-for-byte backup was saved as `~/Downloads/project.before-reference-review-2026-10-27.json`. Original data cells and source provenance remain available in `import_metadata`.
