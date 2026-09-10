# Shapeshift Studio Core

Private, proprietary ES modules shared by Little Gods and Shapeshift Studio Web.

The package owns JSON entity/component validation and commands, references, 2D transforms and procedural motion, IK, 3D scene definitions, illustrated materials/rendering, lighting, grading, facial animation, controllers, effects and procedural audio. Content and editor UI are supplied by consumers. Three.js is a peer dependency so consumers share one renderer instance.

Install with an npm account granted access: `npm install @shapeshift-labs/studio-core`.

Use focused exports (for example `@shapeshift-labs/studio-core/fx/motion`, `@shapeshift-labs/studio-core/entities/definitions`, `@shapeshift-labs/studio-core/scene3d/core/renderer`) so bundlers include only the modules used. Module exports are listed explicitly in package.json. Filesystem layouts are private; use the exported module paths.

The package does not include artwork, demo scenes, secrets, generated bundles, browser UI or village-specific rules. Browser code can be inspected by players; the private repository and restricted npm access control source distribution, not visibility of executed JavaScript.

Body joins are opt-in. `body-joins` exports validated authoring commands, pose evaluation, XY vertex deformation and a Three geometry binding. `body-join-profiles` matches silhouettes and colour transitions; `body-join-render` warps the source paint; `body-join-seams` preserves exterior ink while repairing internal cut lines. Canvas helpers require a browser; importing the math and geometry APIs is DOM-free. The game adapter composes seam repairs over the original vector geometry. `scene3d/chamfer` and `scene3d/surface-detail` provide the textured bevel and authored map primitives used by Studio pillars.
