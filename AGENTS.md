# Shapeshift Studio Core

Start with `README.md` and `docs/features.md`. `src/catalog/features.json` is the shared discovery catalogue for Core, Studio Web, the offline CLI and the live API. Its `/catalog` export offers pure, DOM-free search and validated recipe expansion.

When adding a public module, add its supported export and catalogue feature. Recipe schemas describe inputs to explicit request templates, not arbitrary project data. Run `npm run catalog:docs` to regenerate the feature guide; do not hand-edit generated documentation.

Run `npm test` for changes to the catalogue or public modules. Tests check export coverage, immutable search results, validated recipes and documentation freshness. Studio Web additionally tests the recipes against its real command dispatcher and project store.
