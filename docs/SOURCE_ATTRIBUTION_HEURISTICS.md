# Source Attribution Heuristics

The Climence dashboard features a "Source Attribution" analytical breakdown that estimates the dominant sources of current air pollution. Since Climence operates on real-time sensor telemetry rather than a specialized chemical analysis machine learning model, it relies on a deterministic set of **environmental heuristics**.

These mathematical formulas evaluate the live blend of gases (PM2.5, NO₂, CO₂) alongside environmental factors (humidity) to accurately identify what is likely causing the pollution at any given moment.

The logic is defined in `frontend/src/lib/analytics.ts` via the `computeSourceAttribution` function.

## 1. Traffic

**Formula:**
```text
Traffic Score = (NO₂ × 1.1) + (max(0, CO₂ - 400) × 0.05)
```

**Rationale:**
Internal combustion engine vehicles emit high concentrations of Nitrogen Dioxide (NO₂) and Carbon Dioxide (CO₂). 
- The formula strongly weighs **NO₂**, applying a multiplier of `1.1` because NO₂ is the primary indicator of dense vehicle exhaust.
- It also factors in **CO₂**, but intentionally subtracts the approximate global atmospheric baseline of `400 ppm`. Only the *excess* CO₂ contributes to the traffic score, and it is given a minor multiplier of `0.05`.

## 2. Industry

**Formula:**
```text
Industry Score = (max(0, PM2.5 - 40) × 0.8) + (max(0, CO₂ - 500) × 0.04)
```

**Rationale:**
Industrial factories and power plants produce heavy soot (PM2.5) combined with massive, concentrated outputs of CO₂.
- The formula ignores trace particulates, only activating when **PM2.5** exceeds a concerning threshold of `40 µg/m³`. When it does, this excess is heavily weighted with a multiplier of `0.8`.
- Similarly, it looks for extremely dense **CO₂** concentrations exceeding `500 ppm` (indicating heavy industrial combustion) and adds it to the score.

## 3. Dust & Sandstorms

**Formula:**
```text
Dust Score = max(0, PM2.5 - 25) × (Humidity < 30% ? 1.2 : 0.5)
```

**Rationale:**
In the context of Saudi Arabia (Riyadh), massive spikes in PM2.5 are often caused by natural sand and dust storms rather than man-made pollution. However, these storms strictly occur in very dry weather.
- The formula looks at **PM2.5** exceeding `25 µg/m³`.
- It relies on a critical environmental modifier: **Humidity**.
  - If the humidity is **below 30%** (dry conditions), it amplifies the PM2.5 score by `1.2`, heavily attributing the pollution to a dust storm.
  - If the humidity is **above 30%** (wet or humid conditions), a sandstorm is physically unlikely. In this scenario, it slashes the multiplier to `0.5`, implying the PM2.5 is more likely coming from smog or industrial condensation.

## 4. Other (Baseline)

**Formula:**
```text
Other Score = 10
```

**Rationale:**
A constant baseline score of `10` is maintained at all times to account for background, untrackable atmospheric pollution and minor localized sources.

## Percentage Normalization

Once the individual scores are calculated dynamically, they are combined into a total and normalized into percentages to power the dashboard charts.

```text
Total Score = Traffic Score + Industry Score + Dust Score + Other Score

Traffic %  = (Traffic Score / Total Score) × 100
Industry % = (Industry Score / Total Score) × 100
Dust %     = (Dust Score / Total Score) × 100
Other %    = (Other Score / Total Score) × 100
```

This mathematical approach allows the simulation to render highly realistic, reactive source charts based purely on the physical composition of the live sensor data.
