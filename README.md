# Risk Assessment Web

Risk Assessment Web calculates, visualizes, and reports air-pollution health risk.

The repository currently contains:

- `web/` — new offline-first browser PWA.
- `launcher/` — small Go localhost launcher for archive distribution of the PWA.
- `tools/catalog-audit.mjs` — catalog curation/audit generator.

Current workflow:

1. **Project**: edit the project title, select risk types, select or add agents.
2. **Research objects**: add objects manually or from the map, then enter concentrations for each year (the current year is the default). Population and death counts are shared across years.
3. **Results**: choose a risk measure, places, agents, and years in the comparison builder; compare individual agents, totals, or organ HI with tables and grouped bars or yearly trends. Select a year and agent/organ for maps, then copy/download/add each view individually.
4. **Report**: collect selected tables/charts/maps and print a structured report to PDF.

Theme, project import/export, colors, and the basic/expanded catalog toggle live on the **Settings** page in the left sidebar.

Saved projects use the `schema_version: 1` JSON format. Old project files are not treated as compatible. The bundled `research.json` is audited into a basic catalog and a deduplicated expanded catalog.

Within schema 1, `research.years` lists study years and each exposure has a `year`; existing schema-1 projects without these fields load into the current year. Duplicate exposure validation applies to object/agent/year. Saved report comparisons retain their filters; years are independent exposure scenarios and are never summed together.

## Web PWA

Setup:

```
make install
make audit
```

Development requires Node.js 20.19+ and Go 1.22+ if you build the optional launcher.

Build and test:

```
make build
make test
```

Preview locally:

```
make preview
```

The PWA caches the interface and default catalog after the first launch. Calculations, project autosave, JSON import/export, TSV export, PNG/TSV/GeoJSON export, and report preview work offline. OpenStreetMap tiles, reverse geocoding, and the optional pollution-source overlay require network access.

User instructions are in [`manual/risk_assessment_web_manual.md`](manual/risk_assessment_web_manual.md).

Archive distribution is intended to ship `web/dist` plus a launcher binary built from `launcher/`:

```
make launcher-build
./launcher/bin/rat-launcher --dir web/dist
```

## GitHub Pages

https://nikilark.github.io/risk_assessment_web/
