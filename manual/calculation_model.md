# Calculation model and decisions

The calculation revision uses the supplied diploma extract `risk_assessment.txt` (reviewed 2026-10-24) and the existing implementation. It corrects the identified discrepancies without replacing the underlying mortality model or the acute cancer scenario.

## Lifetime cancer exposure

The lifetime is 70 years: 6 years at ages 0–6, 12 years at ages 6–18, and 52 years at ages 18–70. The prior implementation incorrectly weighted the adult stage by 18 years. The intended adult duration is **52**, not 55: `70 - 6 - 12 = 52`.

| Stage | Years | Inhalation rate (m³/day) | Body weight (kg) |
|---|---:|---:|---:|
| Child | 6 | 4 | 15 |
| Adolescent | 12 | 20 | 42 |
| Adult | 52 | 22 | 70 |

At 350 exposure days/year:

```text
ADD(stage) = C × inhalation rate × 350 / (body weight × 365)
LADD = (6 × ADD(child) + 12 × ADD(adolescent) + 52 × ADD(adult)) / 70
ICR = LADD × SF
PCR = ICR × population
PCRa = PCR / 70
```

Each stage ADD is averaged over that stage (`ED = AT`), so those two factors cancel. The implementation's adult body weight of 70 kg is retained. The diploma's adult paragraph lists 6 years, 15 kg, and 70 years averaging, which conflicts with its own age-stage description; those values are not adopted. The 70 kg adult weight also agrees with the default in [MOH recommendations No. 1811, section III.16](https://moz.gov.ua/uploads/10/50566-dn_1811_18102023_met_rek.pdf).

The existing acute calculation remains `C × 20 × 350 × 70 / (60 × 70 × 365)`, matching the diploma equation. Its use of lifetime exposure despite the acute label is unresolved.

## Cancer categories

Cancer has four categories: minimal below `1e-6`, low from `1e-6` to below `1e-4`, medium from `1e-4` to below `1e-3`, and high from `1e-3` upward. The extra critical cancer category is removed from calculations and map legends, including PNG exports and printed maps.

The existing boundary convention at exactly `1e-6` is retained because the diploma includes that value in both minimal and low ranges. Non-cancer calculations retain all five categories and their existing boundaries.

## Particle mortality

The supplied diploma defines:

```text
C(PM10) = entered PM10 concentration
C(PM10) = 0.6 × entered TSP concentration, when the agent is TSP
IRM = annual deaths × 0.005 / (365 × population)
SF = IRM × 70 × 365
AM = C(PM10) × SF × population
AM per 10000 = AM / population × 10000
```

The unexplained `0.55` multiplier is removed. TSP conversion happens exactly once, before AM. Detailed results expose the effective `C(PM10)`. For the same numeric input `C = 0.1`, annual deaths `100`, and population `50000`, the literal equations yield AM `3.5` for PM10 and `2.1` for TSP. These are arithmetic regression examples, not a validation of concentration units.

PM2.5 and unrecognized particle types are excluded from this mortality model because no applicable formula is provided. PM2.5 remains available for non-cancer HQ/HI with the existing catalog reference concentrations.

### Remaining mortality limitations

The diploma describes a response per 10 µg/m³ but allows concentration input in mg/m³ or µg/m³ without specifying the conversion in its AM equation. This revision does not guess a concentration scale or introduce a new response function: the IRM/SF equations and their numeric concentration convention remain as written. Unit normalization requires a separate decision before treating the values as validated health-impact estimates.

The existing five-level mortality classification is also retained; the diploma supplies no mortality-specific classification. These limitations are stated in result/report method notes. Population and annual death counts remain shared across study years.
