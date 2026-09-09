# Shapeshift Studio Core

Private, proprietary ES modules shared by Little Gods and Shapeshift Studio Web.

The package owns JSON entity/component validation and commands, references, 2D transforms and procedural motion, IK, 3D scene definitions, illustrated materials/rendering, lighting, grading, facial animation, controllers, effects and procedural audio. Content and editor UI are supplied by consumers. Three.js is a peer dependency so consumers share one renderer instance.

Install with an npm account granted access: `npm install @shapeshift-labs/studio-core`.

Use focused exports (for example `@shapeshift-labs/studio-core/fx/motion`, `@shapeshift-labs/studio-core/entities/definitions`, `@shapeshift-labs/studio-core/scene3d/core/renderer`) so bundlers include only the modules used. Module exports are listed explicitly in package.json. Filesystem layouts are private; use the exported module paths.

The package does not include artwork, demo scenes, secrets, generated bundles, browser UI or village-specific rules. Browser code can be inspected by players; the private repository and restricted npm access control source distribution, not visibility of executed JavaScript.
