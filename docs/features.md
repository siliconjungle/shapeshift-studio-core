# Shapeshift Studio feature catalogue

Generated from Studio Core `src/catalog/features.json`. Edit that source and regenerate; the editor, CLI and API read the same catalogue.

## Start here

- In the editor, choose **Features**. Search by task, tool, command or Core import.
- Offline: `npm run studio -- catalog`, `npm run studio -- catalog --query liquid`, or `npm run studio -- catalog liquid`.
- Recipe inputs: `npm run studio -- recipe add-liquid --json '{"joint":"body","fill":0.7}'`. This prints requests; it does not execute them.
- Live API: `catalog.search`, `catalog.feature`, `catalog.recipe` and `catalog.command`.
- Core: import `{queryCatalog, expandRecipe}` from `@shapeshift-labs/studio-core/catalog`.

A recipe’s JSON Schema describes its inputs. The advanced command index lists every advertised authoring command; it is not a full schema for every project payload. Read the project for IDs, check recipe requirements, and dispatch requests explicitly. The runtime still validates project-dependent constraints.

## Contents

- [Projects and portable files](#projects) — Create projects, edit joints and clips, save portable JSON, and undo or redo changes.
- [Agent API and CLI](#headless) — Inspect a live editor, discover controls, apply atomic command batches and export artifacts through the same project store.
- [Keyframes and easing](#keyframes) — Animate rest-relative joint transforms with smooth, stepped, elastic, bounce or custom Bezier interpolation.
- [Shared timeline](#timeline) — Inspect tracks and retime transform, constraint, speech, drawing and sound keys together.
- [Motion layers and secondary motion](#motion) — Author contacts, look targets, follow motion, masked clip layers, pose offsets, smears and morphs.
- [Procedural 2D rigs](#procedural) — Build ropes, spines, tentacles, soft bodies and walking rigs with particles, constraints, collisions, support and dynamic ink surfaces.
- [Procedural 3D locomotion](#procedural3d) — Plan stepping, reaching and following chains over terrain, including body support, target movement and tracking.
- [Noodle deformation](#noodle) — Bend artwork and geometry around a continuous spine with stretch, twist, lag, overshoot and volume preservation.
- [Artwork meshes](#meshes) — Create grids or custom contours, triangulate artwork, animate vertices and paint bone weights.
- [SVG bone binding](#bone-binding) — Bind SVG points and independent Bezier handles to bones with normalized weights.
- [Constraints and inverse kinematics](#constraints) — Constrain translation, rotation, scale, transform or distance, and solve 2D IK chains with animated influence.
- [Follow Path](#follow-path) — Move and orient a joint along an editable SVG path with keyed distance and constraint strength.
- [Pose joysticks](#joysticks) — Drive two source timelines with an animated handle, a world-space target or nested joystick controls.
- [Solo drawing swaps](#solos) — Show one child branch at a time using default choices and held animation keys.
- [Animated draw order](#draw-order) — Move drawable branches in front of or behind other artwork without changing joint parents.
- [Animation state machines](#state-machines) — Connect clips with boolean, number and trigger inputs, conditional transitions and layered pose blending.
- [Soft body joins](#body-joins) — Join overlapping puppet parts with silhouette-aware deformation and paint continuity.
- [SVG artwork editor](#vector-art) — Edit paths and Bezier handles, colours, gradients, swatches, shape order, booleans and point animation.
- [Animated path trimming](#trim-path) — Reveal or offset stroked paths by length, with synced or sequential contour timing.
- [Vector clipping](#clipping) — Clip artwork to other vector shapes, including inversion and animated clip sources.
- [N-slicing and outline detection](#n-slicing) — Resize artwork while preserving corners and selected regions; recognize outlines for deformation workflows.
- [Shape Lab](#shape-lab) — Combine implicit fields into editable contours, SVG animations or 3D meshes and mesh sequences.
- [Illustration motion and folds](#illustration) — Add line boil, edge treatment, pose-driven drawing corrections, motion fields, receivers and 3D bend regions.
- [Container liquid and potion sounds](#liquid) — Animate a sealed liquid surface with area-preserving fill, slosh, damping, viscosity, colour, bubbles and optional sound presets.
- [Colour shifts and effect bindings](#colour-shift) — Animate hue or tint while protecting ink, and bind illustration channels to runtime effect data.
- [Recorded speech and lip sync](#speech) — Place recordings on a timeline with visemes, coarticulation, facial poses, drawing swaps and envelope-driven motion.
- [3D facial animation](#facial3d) — Drive expression, blinks, gaze and eye landmarks independently from body animation.
- [Illustrated 3D scenes](#scene3d) — Build scenes from primitives, SVG planes, extrusions, lathes, meshes and 2D puppet instances; animate transforms and camera settings.
- [Materials, surfaces and ink outlines](#materials) — Author illustrated shading, paint-preserving surfaces, freehand outlines, bevels, surface detail and face artwork.
- [Dice and regular solids](#solids) — Create regular solids and dice geometry, with face artwork and a bundled physics example.
- [Lighting and glowing artwork](#lighting) — Attach lights to joints or scene objects and animate tint, emission, range and environment light.
- [Particles](#particles) — Author particle emitters and key their parameters for sparks, dust and atmospheric effects.
- [Fluid fields and vector contours](#fluid-fields) — Author 2D fluid effects with surface tension and vector contour rendering.
- [Compositing and presentation cues](#compositing) — Connect effect nodes, key numeric parameters and add timed flashes, shake, hitstop and other presentation cues.
- [Colour grading](#grading) — Apply scene-wide colour presets and grading controls after lighting, shadows and effects.
- [Backgrounds and parallax](#backdrops) — Layer, order and animate scene backdrops independently from the puppet.
- [Sound design](#sound) — Author sound libraries and timed cues, including procedural synthesis and liquid sound presets.
- [Reusable component library](#library) — Capture and place reusable puppets, motion and other components with dependency remapping and explicit source updates.
- [Appearance roles and variants](#appearance) — Bind semantic colour roles, switch variants and apply consistent styling to artwork.
- [Entities and component schemas](#entities) — Define component schemas, entity templates and references for application-defined state.
- [Data-defined behaviours and attached effects](#behaviours) — Run component operations and timed state transitions, and bind transforms, attachments, beams and effects to controller state.
- [Reusable actions](#actions) — Capture parameterized animation actions and instantiate them on other targets.
- [Property ownership and resolved channels](#ownership) — Inspect competing animation sources, key handovers, and bake resolved properties for predictable playback.
- [Gesture recording](#recording) — Record interactive edits into animation tracks and simplify captured keys.
- [Preview scenarios and references](#preview) — Compare poses and clips in preview scenarios and save references for review.
- [Rendering and exports](#export) — Export portable projects, runtime modules, HTML players, SVG artwork, PNGs, GIFs, sprite sheets and frame archives.
- [Image to SVG](#image-vectorizer) — Convert raster artwork into layered vector paths using the optional native Node pipeline.
- [Video to tracked SVG](#video-vectorizer) — Convert video frames into temporally tracked vector artwork, with palette, motion and outline controls.
- [Runtime foundations](#runtime-foundations) — Import focused math, geometry, vector rendering, deformation and validation modules without loading the editor.

<a id="projects"></a>
## Projects and portable files

Create projects, edit joints and clips, save portable JSON, and undo or redo changes.

Category: Getting started. Available in: web.

Requirements:
- Open an editor project to author this feature.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/docs/live-api.md)

Commands: `asset.add`, `asset.remove`, `asset.update`, `clip.add`, `clip.bake`, `clip.duplicate`, `clip.remove`, `clip.update`, `joint.add`, `joint.ik`, `joint.origin`, `joint.remove`, `joint.rename`, `joint.update`, `project.patch`, `project.rename`, `project.replace`.

### Name the current project

- Use a fresh default project, or supply the IDs from document.read.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe rename-project`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "default": "My first animation",
      "description": "Project display name",
      "minLength": 1
    }
  },
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "document.dispatch",
    "args": {
      "commands": {
        "op": "project.rename",
        "name": "My first animation"
      }
    }
  }
]
```

<a id="headless"></a>
## Agent API and CLI

Inspect a live editor, discover controls, apply atomic command batches and export artifacts through the same project store.

Category: Getting started. Available in: web.

Requirements:
- Discovery works offline. Editing requires npm start and an open editor tab.

Limits:
- The CLI targets an existing browser session; choose --session when several tabs are open.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/docs/live-api.md)

Discover offline, then connect

```sh
npm run studio -- catalog
npm run studio -- catalog --query liquid
npm run studio -- catalog liquid
npm run studio -- recipe add-liquid --json '{"joint":"body","fill":0.7}'
npm run studio -- sessions
npm run studio -- capabilities
```

### Inspect before editing

- A connected editor session.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe inspect-project`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "editor.inspect",
    "args": {
      "project": true
    }
  }
]
```

<a id="keyframes"></a>
## Keyframes and easing

Animate rest-relative joint transforms with smooth, stepped, elastic, bounce or custom Bezier interpolation.

Category: Animation. Available in: web, core.

Requirements:
- Open an editor project to author this feature.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/README.md)

Core imports:
- `@shapeshift-labs/studio-core/authoring/easing`
- `@shapeshift-labs/studio-core/fx/math`

Commands: `key`, `parameter.key`.

### Key a joint rotation

- Use a fresh default project, or supply the IDs from document.read.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe key-rotation`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "joint": {
      "type": "string",
      "default": "body",
      "description": "Existing joint ID",
      "minLength": 1,
      "maxLength": 100
    },
    "clip": {
      "type": "string",
      "default": "idle",
      "description": "Existing animation ID",
      "minLength": 1,
      "maxLength": 100
    },
    "time": {
      "type": "number",
      "default": 1,
      "description": "Seconds within the clip",
      "minimum": 0
    },
    "degrees": {
      "type": "number",
      "default": 20,
      "description": "Rest-relative rotation in degrees",
      "minimum": -360,
      "maximum": 360
    }
  },
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "document.dispatch",
    "args": {
      "commands": {
        "op": "key",
        "joint": "body",
        "clip": "idle",
        "time": 1,
        "value": {
          "rotation": 20
        }
      }
    }
  }
]
```

<a id="timeline"></a>
## Shared timeline

Inspect tracks and retime transform, constraint, speech, drawing and sound keys together.

Category: Animation. Available in: web.

Requirements:
- Open an editor project to author this feature.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/README.md)

Editor tool: **timeline**.

Commands: `timeline.edit`, `timing.marker`, `timing.remove`.

### Open Shared timeline

- A connected editor session.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe open-timeline`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "panel.set",
    "args": {
      "panel": "timeline",
      "open": true
    }
  }
]
```

<a id="motion"></a>
## Motion layers and secondary motion

Author contacts, look targets, follow motion, masked clip layers, pose offsets, smears and morphs.

Category: Animation. Available in: web, core.

Requirements:
- Open an editor project to author this feature.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/README.md)

Editor tool: **motion**.

Core imports:
- `@shapeshift-labs/studio-core/fx/motion`
- `@shapeshift-labs/studio-core/motion-tools/core`
- `@shapeshift-labs/studio-core/motion-tools/scene-layers`

Commands: `motion.clip`, `motion.contact`, `motion.follow`, `motion.layer`, `motion.look`, `motion.morph`, `motion.pose`, `motion.remove`, `motion.smear`, `motion.targetKey`, `motion.update`, `motion.weight`, `preset`.

### Open Motion layers and secondary motion

- A connected editor session.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe open-motion`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "panel.set",
    "args": {
      "panel": "motion",
      "open": true
    }
  }
]
```

<a id="procedural"></a>
## Procedural 2D rigs

Build ropes, spines, tentacles, soft bodies and walking rigs with particles, constraints, collisions, support and dynamic ink surfaces.

Category: Animation. Available in: web, core.

Requirements:
- Open an editor project to author this feature.

Limits:
- 2D rigs can render on a puppet plane in 3D; spatial locomotion is a separate feature.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/docs/procedural-authoring.md)

Editor tool: **procedural**.

Core imports:
- `@shapeshift-labs/studio-core/procedural/model`
- `@shapeshift-labs/studio-core/procedural/constraints`
- `@shapeshift-labs/studio-core/procedural/collision`
- `@shapeshift-labs/studio-core/procedural/simulation`
- `@shapeshift-labs/studio-core/procedural/ink-route`
- `@shapeshift-labs/studio-core/procedural/surfaces`
- `@shapeshift-labs/studio-core/procedural/builders`
- `@shapeshift-labs/studio-core/procedural/commands`
- `@shapeshift-labs/studio-core/procedural/bindings`
- `@shapeshift-labs/studio-core/procedural/sources`
- `@shapeshift-labs/studio-core/procedural/connections`
- `@shapeshift-labs/studio-core/procedural/locomotion`
- `@shapeshift-labs/studio-core/procedural/transfer`
- `@shapeshift-labs/studio-core/procedural/attachments`

Commands: `procedural.attachment`, `procedural.bind`, `procedural.chain`, `procedural.connection`, `procedural.detach`, `procedural.disconnect`, `procedural.driver`, `procedural.gait`, `procedural.impulse`, `procedural.particle`, `procedural.primitive`, `procedural.remove`, `procedural.replace`, `procedural.settings`, `procedural.support`, `procedural.surface`, `procedural.unbind`.

### Open Procedural 2D rigs

- A connected editor session.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe open-procedural`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "panel.set",
    "args": {
      "panel": "procedural",
      "open": true
    }
  }
]
```

### Create a simulated rope

- Use a fresh default project, or supply IDs from document.read. New IDs must be unique.
- Dispatch explicitly; the whole batch is one undoable edit.

CLI: `npm run studio -- recipe create-rope`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "default": "catalog-rope",
      "description": "Unique rig prefix",
      "minLength": 1,
      "maxLength": 100
    },
    "count": {
      "type": "integer",
      "default": 8,
      "description": "Number of rope points",
      "minimum": 3,
      "maximum": 64
    }
  },
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "document.dispatch",
    "args": {
      "commands": {
        "op": "procedural.primitive",
        "values": {
          "id": "catalog-rope",
          "kind": "rope",
          "count": 8
        }
      }
    }
  }
]
```

<a id="procedural3d"></a>
## Procedural 3D locomotion

Plan stepping, reaching and following chains over terrain, including body support, target movement and tracking.

Category: Animation. Available in: web, core.

Requirements:
- A 3D scene and a procedural rig configuration.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/README.md)

Core imports:
- `@shapeshift-labs/studio-core/procedural3d/model`
- `@shapeshift-labs/studio-core/procedural3d/math`
- `@shapeshift-labs/studio-core/procedural3d/terrain`
- `@shapeshift-labs/studio-core/procedural3d/runtime`
- `@shapeshift-labs/studio-core/procedural3d/builders`

Commands: `scene3d.procedural.build`.

<a id="noodle"></a>
## Noodle deformation

Bend artwork and geometry around a continuous spine with stretch, twist, lag, overshoot and volume preservation.

Category: Deformation. Available in: web, core.

Requirements:
- Open an editor project to author this feature.

Limits:
- SVG baking requires editable vector artwork; use rendered export for artwork meshes.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/README.md)

Editor tool: **noodle**.

Core imports:
- `@shapeshift-labs/studio-core/noodle/model`
- `@shapeshift-labs/studio-core/noodle/deform`

Commands: `noodle.bake`, `noodle.bind`, `noodle.key`, `noodle.remove`, `noodle.set`.

Open Noodle deformation example: /puppet-studio/index.html?example=noodle-2d

### Open Noodle deformation

- A connected editor session.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe open-noodle`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "panel.set",
    "args": {
      "panel": "noodle",
      "open": true
    }
  }
]
```

### Enable squash and bend on artwork

- Use a fresh default project, or supply the IDs from document.read.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe add-noodle`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "joint": {
      "type": "string",
      "default": "body",
      "description": "Existing sprite joint",
      "minLength": 1,
      "maxLength": 100
    },
    "stretch": {
      "type": "number",
      "default": 1.2,
      "description": "Spine stretch ratio",
      "minimum": 0.1,
      "maximum": 5
    }
  },
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "document.dispatch",
    "args": {
      "commands": {
        "op": "noodle.set",
        "node": "body",
        "dimension": 2,
        "values": {
          "enabled": true,
          "stretch": 1.2
        }
      }
    }
  }
]
```

<a id="meshes"></a>
## Artwork meshes

Create grids or custom contours, triangulate artwork, animate vertices and paint bone weights.

Category: Deformation. Available in: web, core.

Requirements:
- Open an editor project to author this feature.

Limits:
- Unbind and remove mesh keys before changing topology.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/docs/meshes.md)

Editor tool: **meshes**.

Core imports:
- `@shapeshift-labs/studio-core/mesh`

Commands: `mesh.addVertex`, `mesh.bind`, `mesh.contour`, `mesh.create`, `mesh.edge`, `mesh.enabled`, `mesh.generate`, `mesh.key`, `mesh.paste`, `mesh.positions`, `mesh.remove`, `mesh.removeVertex`, `mesh.unbind`, `mesh.vertex`, `mesh.weights`.

Open Artwork meshes example: /puppet-studio/index.html?example=mesh

### Open Artwork meshes

- A connected editor session.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe open-meshes`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "panel.set",
    "args": {
      "panel": "meshes",
      "open": true
    }
  }
]
```

### Create an artwork mesh grid

- Use a fresh default project, or supply the IDs from document.read.
- Creating a mesh replaces its topology and removes existing mesh keys. Try it on a fresh sprite or undo afterward.

CLI: `npm run studio -- recipe create-mesh`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "joint": {
      "type": "string",
      "default": "body",
      "description": "Existing sprite joint",
      "minLength": 1,
      "maxLength": 100
    },
    "columns": {
      "type": "integer",
      "default": 4,
      "description": "Grid columns",
      "minimum": 1,
      "maximum": 12
    },
    "rows": {
      "type": "integer",
      "default": 4,
      "description": "Grid rows",
      "minimum": 1,
      "maximum": 12
    }
  },
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "document.dispatch",
    "args": {
      "commands": {
        "op": "mesh.create",
        "joint": "body",
        "columns": 4,
        "rows": 4
      }
    }
  }
]
```

<a id="bone-binding"></a>
## SVG bone binding

Bind SVG points and independent Bezier handles to bones with normalized weights.

Category: Deformation. Available in: web, core.

Requirements:
- Editable SVG artwork and control joints.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/docs/bone-binding.md)

Editor tool: **boneBindings**.

Core imports:
- `@shapeshift-labs/studio-core/bone-binding`

Commands: `boneBinding.bind`, `boneBinding.enabled`, `boneBinding.unbind`, `boneBinding.weights`.

### Open SVG bone binding

- A connected editor session.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe open-bone-binding`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "panel.set",
    "args": {
      "panel": "boneBindings",
      "open": true
    }
  }
]
```

### Bind SVG artwork to its parent

- Use a fresh default project, or supply the IDs from document.read.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe bind-svg`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "joint": {
      "type": "string",
      "default": "body",
      "description": "Editable SVG sprite joint",
      "minLength": 1,
      "maxLength": 100
    },
    "bone": {
      "type": "string",
      "default": "root",
      "description": "Existing control joint",
      "minLength": 1,
      "maxLength": 100
    },
    "clip": {
      "type": "string",
      "default": "idle",
      "description": "Existing animation ID",
      "minLength": 1,
      "maxLength": 100
    }
  },
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "document.dispatch",
    "args": {
      "commands": {
        "op": "boneBinding.bind",
        "joint": "body",
        "clip": "idle",
        "time": 0,
        "bones": [
          "root"
        ]
      }
    }
  }
]
```

<a id="constraints"></a>
## Constraints and inverse kinematics

Constrain translation, rotation, scale, transform or distance, and solve 2D IK chains with animated influence.

Category: Animation. Available in: web, core.

Requirements:
- Open an editor project to author this feature.

Limits:
- IK chain authoring is 2D; transform and distance constraints also support 3D.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/docs/constraints.md)

Editor tool: **constraints**.

Core imports:
- `@shapeshift-labs/studio-core/constraints`
- `@shapeshift-labs/studio-core/constraints/solve2d`
- `@shapeshift-labs/studio-core/constraints/solve3d`

Commands: `constraint.add`, `constraint.key`, `constraint.order`, `constraint.remove`, `constraint.update`.

Open Constraints and inverse kinematics example: /puppet-studio/index.html?example=constraints

### Open Constraints and inverse kinematics

- A connected editor session.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe open-constraints`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "panel.set",
    "args": {
      "panel": "constraints",
      "open": true
    }
  }
]
```

### Constrain a joint to a fixed distance

- Use a fresh default project, or supply IDs from document.read. New IDs must be unique.
- Dispatch explicitly; the whole batch is one undoable edit.

CLI: `npm run studio -- recipe distance-constraint`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "default": "catalog-distance",
      "description": "Unique constraint ID",
      "minLength": 1,
      "maxLength": 100
    },
    "joint": {
      "type": "string",
      "default": "body",
      "description": "Owner joint",
      "minLength": 1,
      "maxLength": 100
    },
    "target": {
      "type": "string",
      "default": "root",
      "description": "Different target joint",
      "minLength": 1,
      "maxLength": 100
    },
    "distance": {
      "type": "number",
      "default": 100,
      "description": "Distance in 2D pixels",
      "minimum": 0,
      "maximum": 10000
    }
  },
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "document.dispatch",
    "args": {
      "commands": {
        "op": "constraint.add",
        "id": "catalog-distance",
        "node": "body",
        "target": "root",
        "type": "distance",
        "values": {
          "distance": 100
        }
      }
    }
  }
]
```

<a id="follow-path"></a>
## Follow Path

Move and orient a joint along an editable SVG path with keyed distance and constraint strength.

Category: Animation. Available in: web, core.

Requirements:
- An editable SVG path target in the 2D rig.

Limits:
- Warped, cropped, sliced and procedural-bound path targets are not supported; point morphs and SVG bone binding are supported.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/docs/follow-path.md)

Editor tool: **constraints**.

Core imports:
- `@shapeshift-labs/studio-core/constraints`
- `@shapeshift-labs/studio-core/constraints/solve2d`
- `@shapeshift-labs/studio-core/constraints/solve3d`

Commands: `constraint.add`, `constraint.key`, `constraint.order`, `constraint.remove`, `constraint.update`.

Open Follow Path example: /puppet-studio/index.html?example=follow-path

### Open Follow Path

- A connected editor session.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe open-follow-path`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "panel.set",
    "args": {
      "panel": "constraints",
      "open": true
    }
  }
]
```

### Attach a follower to an SVG path

- Use a fresh default project, or supply IDs from document.read. New IDs must be unique.
- Dispatch explicitly; the whole batch is one undoable edit.

CLI: `npm run studio -- recipe follow-svg-path`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "default": "catalog-follower",
      "description": "New follower joint ID",
      "minLength": 1,
      "maxLength": 100
    },
    "constraint": {
      "type": "string",
      "default": "catalog-path",
      "description": "Unique constraint ID",
      "minLength": 1,
      "maxLength": 100
    },
    "target": {
      "type": "string",
      "default": "body",
      "description": "Joint with editable SVG artwork",
      "minLength": 1,
      "maxLength": 100
    },
    "distance": {
      "type": "number",
      "default": 0.25,
      "description": "Normalized path distance",
      "minimum": 0,
      "maximum": 1
    }
  },
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "document.dispatch",
    "args": {
      "commands": [
        {
          "op": "joint.add",
          "id": "catalog-follower"
        },
        {
          "op": "constraint.add",
          "id": "catalog-path",
          "node": "catalog-follower",
          "target": "body",
          "type": "followPath",
          "values": {
            "distance": 0.25,
            "orient": true
          }
        }
      ]
    }
  }
]
```

<a id="joysticks"></a>
## Pose joysticks

Drive two source timelines with an animated handle, a world-space target or nested joystick controls.

Category: Animation. Available in: web, core.

Requirements:
- Open an editor project to author this feature.

Limits:
- Sources must not claim the same property. Joysticks control 2D rigs, including their 3D puppet instances.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/docs/joysticks.md)

Editor tool: **joysticks**.

Core imports:
- `@shapeshift-labs/studio-core/joysticks`

Commands: `joystick.configure`, `joystick.create`, `joystick.default`, `joystick.key`, `joystick.remove`.

Open Pose joysticks example: /puppet-studio/index.html?example=joysticks

### Open Pose joysticks

- A connected editor session.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe open-joysticks`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "panel.set",
    "args": {
      "panel": "joysticks",
      "open": true
    }
  }
]
```

### Animate a pose joystick

- Open ?example=joysticks first, or provide equivalent project IDs.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe key-joystick`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "node": {
      "type": "string",
      "default": "look",
      "description": "Joystick joint ID",
      "minLength": 1,
      "maxLength": 100
    },
    "clip": {
      "type": "string",
      "default": "look-around",
      "description": "Clip ID",
      "minLength": 1,
      "maxLength": 100
    },
    "x": {
      "type": "number",
      "default": 0.5,
      "description": "Horizontal coordinate",
      "minimum": -1,
      "maximum": 1
    },
    "y": {
      "type": "number",
      "default": -0.5,
      "description": "Vertical coordinate",
      "minimum": -1,
      "maximum": 1
    },
    "time": {
      "type": "number",
      "default": 0.5,
      "description": "Seconds",
      "minimum": 0
    }
  },
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "document.dispatch",
    "args": {
      "commands": {
        "op": "joystick.key",
        "node": "look",
        "clip": "look-around",
        "time": 0.5,
        "value": [
          0.5,
          -0.5
        ]
      }
    }
  }
]
```

<a id="solos"></a>
## Solo drawing swaps

Show one child branch at a time using default choices and held animation keys.

Category: Animation. Available in: web, core.

Requirements:
- Open an editor project to author this feature.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/docs/solos.md)

Editor tool: **solos**.

Core imports:
- `@shapeshift-labs/studio-core/solos`

Commands: `solo.create`, `solo.default`, `solo.disable`, `solo.enable`, `solo.key`, `solo.wrap`.

Open Solo drawing swaps example: /puppet-studio/index.html?example=solos

### Open Solo drawing swaps

- A connected editor session.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe open-solos`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "panel.set",
    "args": {
      "panel": "solos",
      "open": true
    }
  }
]
```

### Key a drawing swap

- Open ?example=solos first, or provide equivalent project IDs.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe key-solo`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "node": {
      "type": "string",
      "default": "expressions",
      "description": "Solo group ID",
      "minLength": 1,
      "maxLength": 100
    },
    "clip": {
      "type": "string",
      "default": "expressions",
      "description": "Clip ID",
      "minLength": 1,
      "maxLength": 100
    },
    "child": {
      "type": "string",
      "default": "surprised",
      "description": "Direct child drawing ID",
      "minLength": 1,
      "maxLength": 100
    },
    "time": {
      "type": "number",
      "default": 0.5,
      "description": "Seconds",
      "minimum": 0
    }
  },
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "document.dispatch",
    "args": {
      "commands": {
        "op": "solo.key",
        "node": "expressions",
        "clip": "expressions",
        "value": "surprised",
        "time": 0.5
      }
    }
  }
]
```

<a id="draw-order"></a>
## Animated draw order

Move drawable branches in front of or behind other artwork without changing joint parents.

Category: Animation. Available in: web, core.

Requirements:
- Open an editor project to author this feature.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/docs/draw-order.md)

Editor tool: **drawOrder**.

Core imports:
- `@shapeshift-labs/studio-core/draw-order`

Commands: `drawOrder.add`, `drawOrder.default`, `drawOrder.key`, `drawOrder.remove`, `drawOrder.update`.

Open Animated draw order example: /puppet-studio/index.html?example=draw-order

### Open Animated draw order

- A connected editor session.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe open-draw-order`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "panel.set",
    "args": {
      "panel": "drawOrder",
      "open": true
    }
  }
]
```

<a id="state-machines"></a>
## Animation state machines

Connect clips with boolean, number and trigger inputs, conditional transitions and layered pose blending.

Category: Animation. Available in: web, core.

Requirements:
- Open an editor project to author this feature.

Limits:
- The editor state-machine preview is silent; clip visuals use the dominant animation.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/docs/state-machines.md)

Editor tool: **stateMachines**.

Core imports:
- `@shapeshift-labs/studio-core/state-machine`

Commands: `stateMachine.put`, `stateMachine.remove`.

### Open Animation state machines

- A connected editor session.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe open-state-machines`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "panel.set",
    "args": {
      "panel": "stateMachines",
      "open": true
    }
  }
]
```

### Create a clip-driven state machine

- Use a fresh default project, or supply IDs from document.read. New IDs must be unique.
- Dispatch explicitly; the whole batch is one undoable edit.

CLI: `npm run studio -- recipe create-state-machine`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "default": "catalog-machine",
      "description": "New machine ID (existing ID replaces that machine)",
      "minLength": 1,
      "maxLength": 100
    },
    "clip": {
      "type": "string",
      "default": "idle",
      "description": "Existing 2D animation clip",
      "minLength": 1,
      "maxLength": 100
    }
  },
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "document.dispatch",
    "args": {
      "commands": {
        "op": "stateMachine.put",
        "value": {
          "id": "catalog-machine",
          "name": "Clip player",
          "dimension": 2,
          "inputs": [],
          "layers": [
            {
              "id": "base",
              "name": "Base layer",
              "enabled": true,
              "entry": "play",
              "states": [
                {
                  "id": "play",
                  "name": "Play clip",
                  "type": "animation",
                  "clip": "idle",
                  "speed": 1,
                  "playback": "clip",
                  "x": 100,
                  "y": 100
                }
              ],
              "transitions": []
            }
          ]
        }
      }
    }
  }
]
```

<a id="body-joins"></a>
## Soft body joins

Join overlapping puppet parts with silhouette-aware deformation and paint continuity.

Category: Deformation. Available in: web, core.

Requirements:
- Overlapping artwork parts and an explicit target joint or solid body.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/README.md)

Editor tool: **bodyJoins**.

Core imports:
- `@shapeshift-labs/studio-core/body-joins`
- `@shapeshift-labs/studio-core/body-join-profiles`
- `@shapeshift-labs/studio-core/body-join-render`
- `@shapeshift-labs/studio-core/body-join-seams`
- `@shapeshift-labs/studio-core/scene3d/attachment-blend`

Commands: `bodyJoin.create`, `bodyJoin.remove`, `bodyJoin.update`.

Open Soft body joins example: /puppet-studio/index.html?example=body-joins

### Open Soft body joins

- A connected editor session.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe open-body-joins`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "panel.set",
    "args": {
      "panel": "bodyJoins",
      "open": true
    }
  }
]
```

<a id="vector-art"></a>
## SVG artwork editor

Edit paths and Bezier handles, colours, gradients, swatches, shape order, booleans and point animation.

Category: Artwork. Available in: web, core.

Requirements:
- Open SVG artwork in the Artwork workspace.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/README.md)

Core imports:
- `@shapeshift-labs/studio-core/vector/model`

Commands: `shape`, `text`, `vector.add`, `vector.boolean`, `vector.clip`, `vector.create`, `vector.delete`, `vector.duplicate`, `vector.init`, `vector.key`, `vector.order`, `vector.settings`, `vector.swatch`, `vector.update`.

<a id="trim-path"></a>
## Animated path trimming

Reveal or offset stroked paths by length, with synced or sequential contour timing.

Category: Artwork. Available in: web, core.

Requirements:
- Editable SVG paths with a visible stroke.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/docs/artwork-trim-path.md)

Core imports:
- `@shapeshift-labs/studio-core/vector/model`

Commands: `vector.update`, `vector.key`.

### Trim the end of an SVG stroke

- Use a fresh default project, or supply the IDs from document.read.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe trim-stroke`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "asset": {
      "type": "string",
      "default": "artwork",
      "description": "Editable SVG asset",
      "minLength": 1,
      "maxLength": 100
    },
    "shape": {
      "type": "string",
      "default": "body",
      "description": "Shape inside the asset",
      "minLength": 1,
      "maxLength": 100
    },
    "end": {
      "type": "number",
      "default": 0.65,
      "description": "Visible stroke fraction",
      "minimum": 0,
      "maximum": 1
    }
  },
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "document.dispatch",
    "args": {
      "commands": {
        "op": "vector.update",
        "asset": "artwork",
        "shape": "body",
        "values": {
          "trimEnd": 0.65
        }
      }
    }
  }
]
```

<a id="clipping"></a>
## Vector clipping

Clip artwork to other vector shapes, including inversion and animated clip sources.

Category: Artwork. Available in: web, core.

Requirements:
- Editable SVG artwork containing source and target shapes.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/docs/artwork-clipping.md)

Core imports:
- `@shapeshift-labs/studio-core/vector/model`

Commands: `vector.clip`, `vector.update`, `vector.delete`, `vector.duplicate`.

### Clip artwork to a rectangle

- Use a fresh default project, or supply IDs from document.read. New IDs must be unique.
- The rectangle coordinates fit the default 200×200 artwork. Adjust its points for your own drawing.

CLI: `npm run studio -- recipe clip-svg`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "asset": {
      "type": "string",
      "default": "artwork",
      "description": "Existing editable SVG asset",
      "minLength": 1,
      "maxLength": 100
    },
    "shape": {
      "type": "string",
      "default": "body",
      "description": "Shape to clip",
      "minLength": 1,
      "maxLength": 100
    },
    "mask": {
      "type": "string",
      "default": "catalog-mask",
      "description": "Unique clipping shape ID",
      "minLength": 1,
      "maxLength": 100
    }
  },
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "document.dispatch",
    "args": {
      "commands": [
        {
          "op": "vector.add",
          "asset": "artwork",
          "value": {
            "id": "catalog-mask",
            "name": "Rectangle clip",
            "commands": [
              "M",
              "L",
              "L",
              "L",
              "Z"
            ],
            "points": [
              20,
              20,
              120,
              20,
              120,
              180,
              20,
              180
            ],
            "fill": "#ffffff",
            "stroke": "none",
            "strokeWidth": 0,
            "opacity": 1,
            "hidden": false,
            "locked": false,
            "fillRule": "nonzero",
            "lineCap": "round",
            "lineJoin": "round"
          }
        },
        {
          "op": "vector.clip",
          "asset": "artwork",
          "shape": "body",
          "source": "catalog-mask",
          "hideSource": true
        }
      ]
    }
  }
]
```

<a id="n-slicing"></a>
## N-slicing and outline detection

Resize artwork while preserving corners and selected regions; recognize outlines for deformation workflows.

Category: Deformation. Available in: web, core.

Requirements:
- Open an editor project to author this feature.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/docs/n-slicing.md)

Core imports:
- `@shapeshift-labs/studio-core/n-slicing`
- `@shapeshift-labs/studio-core/outline-recognition`

Commands: `joint.update`, `scene3d.node.update`.

<a id="shape-lab"></a>
## Shape Lab

Combine implicit fields into editable contours, SVG animations or 3D meshes and mesh sequences.

Category: Artwork. Available in: web, core.

Requirements:
- Open an editor project to author this feature.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/docs/shape-lab.md)

Editor tool: **shapeLab**.

Core imports:
- `@shapeshift-labs/studio-core/shape-lab/model`
- `@shapeshift-labs/studio-core/shape-lab/field`
- `@shapeshift-labs/studio-core/shape-lab/contours`
- `@shapeshift-labs/studio-core/shape-lab/mesh`

Commands: `shapeLab.bake`, `shapeLab.create`, `shapeLab.delete`, `shapeLab.key`, `shapeLab.part`, `shapeLab.removePart`, `shapeLab.settings`.

Open Shape Lab example: /puppet-studio/index.html?example=shape-lab

### Open Shape Lab

- A connected editor session.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe open-shape-lab`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "panel.set",
    "args": {
      "panel": "shapeLab",
      "open": true
    }
  }
]
```

### Create an animated implicit shape field

- Use a fresh default project, or supply IDs from document.read. New IDs must be unique.
- Dispatch explicitly; the whole batch is one undoable edit.

CLI: `npm run studio -- recipe create-shape-field`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "default": "catalog-blobs",
      "description": "Unique shape recipe ID",
      "minLength": 1,
      "maxLength": 100
    },
    "dimension": {
      "type": "integer",
      "default": 2,
      "description": "2D contours or 3D mesh field",
      "enum": [
        2,
        3
      ]
    }
  },
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "document.dispatch",
    "args": {
      "commands": {
        "op": "shapeLab.create",
        "id": "catalog-blobs",
        "dimension": 2
      }
    }
  }
]
```

<a id="illustration"></a>
## Illustration motion and folds

Add line boil, edge treatment, pose-driven drawing corrections, motion fields, receivers and 3D bend regions.

Category: Illustration. Available in: web, core.

Requirements:
- Open an editor project to author this feature.

Limits:
- Boil needs editable SVG artwork. Fold regions need a 3D object.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/docs/illustration-tools.md)

Editor tool: **illustration**.

Core imports:
- `@shapeshift-labs/studio-core/illustration/controls`
- `@shapeshift-labs/studio-core/illustration/fold`
- `@shapeshift-labs/studio-core/illustration/contours`

Commands: `illustration.boil`, `illustration.corrective`, `illustration.edge`, `illustration.field`, `illustration.fold`, `illustration.receiver`.

Open Illustration motion and folds example: /puppet-studio/index.html?example=book

### Open Illustration motion and folds

- A connected editor session.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe open-illustration`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "panel.set",
    "args": {
      "panel": "illustration",
      "open": true
    }
  }
]
```

### Animate a hand-drawn line boil

- Use a fresh default project, or supply the IDs from document.read.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe line-boil`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "joint": {
      "type": "string",
      "default": "body",
      "description": "Joint with editable SVG artwork",
      "minLength": 1,
      "maxLength": 100
    },
    "amount": {
      "type": "number",
      "default": 0.6,
      "description": "Boil displacement",
      "minimum": 0,
      "maximum": 5
    }
  },
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "document.dispatch",
    "args": {
      "commands": {
        "op": "illustration.boil",
        "joint": "body",
        "values": {
          "enabled": true,
          "amount": 0.6
        }
      }
    }
  }
]
```

<a id="liquid"></a>
## Container liquid and potion sounds

Animate a sealed liquid surface with area-preserving fill, slosh, damping, viscosity, colour, bubbles and optional sound presets.

Category: Illustration. Available in: web, core.

Requirements:
- A 2D puppet joint with a container boundary.

Limits:
- This is a sealed 2D spring-surface model, not a general 3D fluid solver.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/README.md)

Editor tool: **illustration**.

Core imports:
- `@shapeshift-labs/studio-core/illustration/container-liquid`
- `@shapeshift-labs/studio-core/illustration/liquid-actions`
- `@shapeshift-labs/studio-core/illustration/liquid-audio`
- `@shapeshift-labs/studio-core/illustration/tracks`

Commands: `illustration.key`, `illustration.liquid`, `illustration.removeKeys`, `illustration.soundPreset`.

Open Container liquid and potion sounds example: /puppet-studio/index.html?example=potion

### Open Container liquid and potion sounds

- A connected editor session.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe open-liquid`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "panel.set",
    "args": {
      "panel": "illustration",
      "open": true
    }
  }
]
```

### Add a sloshing liquid container

- Use a fresh default project, or supply the IDs from document.read.
- The default boundary is a generic container. Customize boundary points to fit your bottle artwork.

CLI: `npm run studio -- recipe add-liquid`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "joint": {
      "type": "string",
      "default": "body",
      "description": "Existing container joint",
      "minLength": 1,
      "maxLength": 100
    },
    "fill": {
      "type": "number",
      "default": 0.65,
      "description": "Filled fraction",
      "minimum": 0,
      "maximum": 1
    },
    "color": {
      "type": "string",
      "default": "#9b66ce",
      "description": "Liquid colour",
      "pattern": "^#[0-9a-fA-F]{6}$"
    }
  },
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "document.dispatch",
    "args": {
      "commands": {
        "op": "illustration.liquid",
        "joint": "body",
        "values": {
          "fill": 0.65,
          "color": "#9b66ce"
        }
      }
    }
  }
]
```

<a id="colour-shift"></a>
## Colour shifts and effect bindings

Animate hue or tint while protecting ink, and bind illustration channels to runtime effect data.

Category: Illustration. Available in: web, core.

Requirements:
- Open an editor project to author this feature.

Limits:
- Colour-shift authoring targets 2D artwork.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/docs/illustration-tools.md)

Editor tool: **illustration**.

Core imports:
- `@shapeshift-labs/studio-core/illustration/tracks`
- `@shapeshift-labs/studio-core/illustration/effect-state`
- `@shapeshift-labs/studio-core/illustration/color-shift`

Commands: `illustration.binding`, `illustration.bindings`, `illustration.colorShift`, `illustration.key`, `illustration.removeKeys`.

### Open Colour shifts and effect bindings

- A connected editor session.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe open-colour-shift`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "panel.set",
    "args": {
      "panel": "illustration",
      "open": true
    }
  }
]
```

### Apply an ink-preserving colour shift

- Use a fresh default project, or supply the IDs from document.read.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe shift-colour`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "joint": {
      "type": "string",
      "default": "body",
      "description": "Existing sprite joint",
      "minLength": 1,
      "maxLength": 100
    },
    "hue": {
      "type": "number",
      "default": 35,
      "description": "Hue rotation in degrees",
      "minimum": -360,
      "maximum": 360
    },
    "amount": {
      "type": "number",
      "default": 0.5,
      "description": "Blend amount",
      "minimum": 0,
      "maximum": 1
    }
  },
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "document.dispatch",
    "args": {
      "commands": {
        "op": "illustration.colorShift",
        "joint": "body",
        "values": {
          "enabled": true,
          "hue": 35,
          "amount": 0.5
        }
      }
    }
  }
]
```

<a id="speech"></a>
## Recorded speech and lip sync

Place recordings on a timeline with visemes, coarticulation, facial poses, drawing swaps and envelope-driven motion.

Category: Audio and faces. Available in: web, core.

Requirements:
- A recording, timed cues and a facial rig mapping.

Limits:
- Studio schedules supplied recordings. Optional voice-generation scripts need your own provider credentials.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/README.md)

Editor tool: **speech**.

Core imports:
- `@shapeshift-labs/studio-core/speech`

Commands: `speech.chunk`, `speech.place`, `speech.remove`, `speech.rig`.

Open Recorded speech and lip sync example: /puppet-studio/index.html?example=speech

### Open Recorded speech and lip sync

- A connected editor session.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe open-speech`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "panel.set",
    "args": {
      "panel": "speech",
      "open": true
    }
  }
]
```

<a id="facial3d"></a>
## 3D facial animation

Drive expression, blinks, gaze and eye landmarks independently from body animation.

Category: Audio and faces. Available in: web, core.

Requirements:
- A 3D node with compatible authored face surfaces and eye landmarks.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/README.md)

Core imports:
- `@shapeshift-labs/studio-core/scene3d/core/facial-animation`
- `@shapeshift-labs/studio-core/scene3d/core/facial-control`
- `@shapeshift-labs/studio-core/scene3d/core/landmark-eye`

Commands: `scene3d.event.add`, `scene3d.event.remove`, `scene3d.event.update`, `scene3d.key`, `scene3d.node.update`.

<a id="scene3d"></a>
## Illustrated 3D scenes

Build scenes from primitives, SVG planes, extrusions, lathes, meshes and 2D puppet instances; animate transforms and camera settings.

Category: 3D scenes. Available in: web, core.

Requirements:
- Open an editor project to author this feature.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/README.md)

Core imports:
- `@shapeshift-labs/studio-core/scene3d/animation`
- `@shapeshift-labs/studio-core/scene3d/core/portable`
- `@shapeshift-labs/studio-core/scene3d/core/renderer`
- `@shapeshift-labs/studio-core/scene3d/schema`
- `@shapeshift-labs/studio-core/scene3d/subdivision`

Commands: `model.add`, `model.remove`, `model.update`, `scene3d.asset.add`, `scene3d.asset.update`, `scene3d.clip.add`, `scene3d.clip.remove`, `scene3d.clip.update`, `scene3d.key`, `scene3d.new`, `scene3d.node.add`, `scene3d.node.remove`, `scene3d.node.update`, `scene3d.replace`, `scene3d.settings`.

### Create and animate a 3D box

- Use a fresh default project, or supply the IDs from document.read.
- scene3d.new replaces the current 3D scene. Use a fresh project or undo the batch.

CLI: `npm run studio -- recipe create-scene-box`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "default": "catalog-box",
      "description": "Unique scene node ID",
      "minLength": 1,
      "maxLength": 100
    }
  },
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "document.dispatch",
    "args": {
      "commands": [
        {
          "op": "scene3d.new"
        },
        {
          "op": "scene3d.node.add",
          "id": "catalog-box",
          "type": "box"
        },
        {
          "op": "scene3d.key",
          "clip": "idle",
          "node": "catalog-box",
          "channel": "rotation",
          "time": 1,
          "value": [
            0,
            45,
            0
          ]
        }
      ]
    }
  }
]
```

<a id="materials"></a>
## Materials, surfaces and ink outlines

Author illustrated shading, paint-preserving surfaces, freehand outlines, bevels, surface detail and face artwork.

Category: 3D scenes. Available in: web, core.

Requirements:
- Open an editor project to author this feature.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/README.md)

Core imports:
- `@shapeshift-labs/studio-core/scene3d/core/materials`
- `@shapeshift-labs/studio-core/scene3d/chamfer`
- `@shapeshift-labs/studio-core/scene3d/surface-detail`
- `@shapeshift-labs/studio-core/scene3d/core/perfect-freehand`

Commands: `scene3d.material.add`, `scene3d.material.remove`, `scene3d.material.update`, `scene3d.surface.remove`, `scene3d.surface.set`.

<a id="solids"></a>
## Dice and regular solids

Create regular solids and dice geometry, with face artwork and a bundled physics example.

Category: 3D scenes. Available in: web, core.

Requirements:
- Open the Scene workspace, then Dice / solid.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/README.md)

Core imports:
- `@shapeshift-labs/studio-core/scene3d/regular-solid`

Commands: `scene3d.node.add`.

Open dice physics example: /puppet-studio/dice/index.html

<a id="lighting"></a>
## Lighting and glowing artwork

Attach lights to joints or scene objects and animate tint, emission, range and environment light.

Category: 3D scenes. Available in: web, core.

Requirements:
- Open an editor project to author this feature.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/README.md)

Core imports:
- `@shapeshift-labs/studio-core/lighting-state`
- `@shapeshift-labs/studio-core/scene3d/core/lighting-definition`
- `@shapeshift-labs/studio-core/scene3d/core/lighting-glsl`
- `@shapeshift-labs/studio-core/scene3d/core/painted-ground`
- `@shapeshift-labs/studio-core/scene3d/core/shape-shadow`

Commands: `lighting.key`, `lighting.node`, `lighting.settings`, `scene3d.key`.

<a id="particles"></a>
## Particles

Author particle emitters and key their parameters for sparks, dust and atmospheric effects.

Category: Effects. Available in: web, core.

Requirements:
- Open an editor project to author this feature.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/README.md)

Editor tool: **fx**.

Core imports:
- `@shapeshift-labs/studio-core/fx/particles`

Commands: `emitter.add`, `emitter.remove`, `emitter.update`, `parameter.key`.

### Open Particles

- A connected editor session.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe open-particles`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "panel.set",
    "args": {
      "panel": "fx",
      "open": true
    }
  }
]
```

### Add a particle emitter

- An editor project with no emitter using the requested ID.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe create-particles`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "default": "catalog-sparks",
      "description": "Unique emitter ID",
      "minLength": 1,
      "maxLength": 100
    }
  },
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "document.dispatch",
    "args": {
      "commands": {
        "op": "emitter.add",
        "id": "catalog-sparks"
      }
    }
  }
]
```

<a id="fluid-fields"></a>
## Fluid fields and vector contours

Author 2D fluid effects with surface tension and vector contour rendering.

Category: Effects. Available in: web, core.

Requirements:
- Open an editor project to author this feature.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/README.md)

Editor tool: **fx**.

Core imports:
- `@shapeshift-labs/studio-core/illustration/fluid`

Commands: `fluid.add`, `fluid.remove`, `fluid.update`.

### Open Fluid fields and vector contours

- A connected editor session.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe open-fluid-fields`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "panel.set",
    "args": {
      "panel": "fx",
      "open": true
    }
  }
]
```

### Add a 2D fluid field

- An editor project with no fluid using the requested ID.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe create-fluid`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "default": "catalog-fluid",
      "description": "Unique fluid ID",
      "minLength": 1,
      "maxLength": 100
    }
  },
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "document.dispatch",
    "args": {
      "commands": {
        "op": "fluid.add",
        "id": "catalog-fluid"
      }
    }
  }
]
```

<a id="compositing"></a>
## Compositing and presentation cues

Connect effect nodes, key numeric parameters and add timed flashes, shake, hitstop and other presentation cues.

Category: Effects. Available in: web, core.

Requirements:
- Open an editor project to author this feature.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/README.md)

Editor tool: **fx**.

Core imports:
- `@shapeshift-labs/studio-core/fx/frames`
- `@shapeshift-labs/studio-core/fx/presentation`

Commands: `cue.add`, `cue.remove`, `cue.update`, `node.add`, `node.connect`, `node.output`, `node.remove`, `node.update`, `settings`, `visual`.

### Open Compositing and presentation cues

- A connected editor session.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe open-compositing`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "panel.set",
    "args": {
      "panel": "fx",
      "open": true
    }
  }
]
```

<a id="grading"></a>
## Colour grading

Apply scene-wide colour presets and grading controls after lighting, shadows and effects.

Category: Artwork. Available in: web, core.

Requirements:
- Open an editor project to author this feature.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/README.md)

Editor tool: **grading**.

Core imports:
- `@shapeshift-labs/studio-core/rendering/color-grading`

Commands: `grading.reset`, `grading.set`.

### Open Colour grading

- A connected editor session.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe open-grading`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "panel.set",
    "args": {
      "panel": "grading",
      "open": true
    }
  }
]
```

### Reset to neutral colour grading

- Use a fresh default project, or supply the IDs from document.read.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe neutral-grade`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "document.dispatch",
    "args": {
      "commands": {
        "op": "grading.reset",
        "preset": "neutral"
      }
    }
  }
]
```

<a id="backdrops"></a>
## Backgrounds and parallax

Layer, order and animate scene backdrops independently from the puppet.

Category: Artwork. Available in: web.

Requirements:
- Open an editor project to author this feature.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/README.md)

Editor tool: **environment**.

Commands: `backdrop.add`, `backdrop.key`, `backdrop.order`, `backdrop.remove`, `backdrop.settings`, `backdrop.update`.

### Open Backgrounds and parallax

- A connected editor session.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe open-backdrops`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "panel.set",
    "args": {
      "panel": "environment",
      "open": true
    }
  }
]
```

<a id="sound"></a>
## Sound design

Author sound libraries and timed cues, including procedural synthesis and liquid sound presets.

Category: Audio and faces. Available in: web, core.

Requirements:
- Open an editor project to author this feature.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/README.md)

Editor tool: **sound**.

Core imports:
- `@shapeshift-labs/studio-core/scene3d/core/audio`

Commands: `audio.library`, `library.soundVolume`.

### Open Sound design

- A connected editor session.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe open-sound`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "panel.set",
    "args": {
      "panel": "sound",
      "open": true
    }
  }
]
```

<a id="library"></a>
## Reusable component library

Capture and place reusable puppets, motion and other components with dependency remapping and explicit source updates.

Category: Reuse and runtime. Available in: web.

Requirements:
- Open an editor project to author this feature.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/README.md)

Editor tool: **library**.

Commands: `library.capture`, `library.detach`, `library.import`, `library.place`, `library.remove`, `library.rename`, `library.soundVolume`, `library.updateSource`.

### Open Reusable component library

- A connected editor session.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe open-library`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "panel.set",
    "args": {
      "panel": "library",
      "open": true
    }
  }
]
```

<a id="appearance"></a>
## Appearance roles and variants

Bind semantic colour roles, switch variants and apply consistent styling to artwork.

Category: Artwork. Available in: web, core.

Requirements:
- Open an editor project to author this feature.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/README.md)

Editor tool: **styles**.

Core imports:
- `@shapeshift-labs/studio-core/authoring/appearance`

Commands: `appearance.bind`, `appearance.grade`, `appearance.init`, `appearance.removeVariant`, `appearance.role`, `appearance.select`, `appearance.unbind`, `appearance.variant`.

### Open Appearance roles and variants

- A connected editor session.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe open-appearance`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "panel.set",
    "args": {
      "panel": "styles",
      "open": true
    }
  }
]
```

<a id="entities"></a>
## Entities and component schemas

Define component schemas, entity templates and references for application-defined state.

Category: Reuse and runtime. Available in: web, core.

Requirements:
- Open an editor project to author this feature.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/docs/live-api.md)

Editor tool: **entities**.

Core imports:
- `@shapeshift-labs/studio-core/entities/commands`
- `@shapeshift-labs/studio-core/entities/definitions`
- `@shapeshift-labs/studio-core/entities/world`

Commands: `component.define`, `component.remove`, `entity.assign`, `entity.create`, `entity.detach`, `entity.duplicate`, `entity.import`, `entity.init`, `entity.remove`, `entity.rename`, `entity.values`.

### Open Entities and component schemas

- A connected editor session.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe open-entities`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "panel.set",
    "args": {
      "panel": "entities",
      "open": true
    }
  }
]
```

<a id="behaviours"></a>
## Data-defined behaviours and attached effects

Run component operations and timed state transitions, and bind transforms, attachments, beams and effects to controller state.

Category: Reuse and runtime. Available in: web, core.

Requirements:
- Entity definitions, a controller library and scene node bindings.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/README.md)

Editor tool: **behaviours**.

Core imports:
- `@shapeshift-labs/studio-core/scene3d/core/action-machine`
- `@shapeshift-labs/studio-core/scene3d/core/action-presenter`
- `@shapeshift-labs/studio-core/scene3d/core/controller-placement`
- `@shapeshift-labs/studio-core/scene3d/core/procedural-effects`
- `@shapeshift-labs/studio-core/scene3d/core/surface-contact`
- `@shapeshift-labs/studio-core/scene3d/core/attachments`
- `@shapeshift-labs/studio-core/behaviour/runtime`

Commands: `scene3d.event.add`, `scene3d.event.remove`, `scene3d.event.update`.

### Open Data-defined behaviours and attached effects

- A connected editor session.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe open-behaviours`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "editor.invoke",
    "args": {
      "target": "behaviours",
      "method": "show",
      "args": []
    }
  }
]
```

<a id="actions"></a>
## Reusable actions

Capture parameterized animation actions and instantiate them on other targets.

Category: Reuse and runtime. Available in: web.

Requirements:
- Open an editor project to author this feature.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/README.md)

Editor tool: **actions**.

Commands: `action.capture`, `action.instantiate`, `action.parameter`, `action.remove`, `action.rename`, `action.values`.

### Open Reusable actions

- A connected editor session.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe open-actions`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "panel.set",
    "args": {
      "panel": "actions",
      "open": true
    }
  }
]
```

<a id="ownership"></a>
## Property ownership and resolved channels

Inspect competing animation sources, key handovers, and bake resolved properties for predictable playback.

Category: Animation. Available in: web, core.

Requirements:
- Open an editor project to author this feature.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/README.md)

Editor tool: **ownership**.

Core imports:
- `@shapeshift-labs/studio-core/authoring/resolved-channels`

Commands: `ownership.bake`, `ownership.bakeSettings`, `ownership.handover`, `ownership.key`, `ownership.removeBake`.

### Open Property ownership and resolved channels

- A connected editor session.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe open-ownership`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "panel.set",
    "args": {
      "panel": "ownership",
      "open": true
    }
  }
]
```

<a id="recording"></a>
## Gesture recording

Record interactive edits into animation tracks and simplify captured keys.

Category: Animation. Available in: web.

Requirements:
- Open an editor project to author this feature.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/README.md)

Commands: `recording.apply`, `recording.simplify`.

<a id="preview"></a>
## Preview scenarios and references

Compare poses and clips in preview scenarios and save references for review.

Category: Reuse and runtime. Available in: web, core.

Requirements:
- Open an editor project to author this feature.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/README.md)

Editor tool: **references**.

Core imports:
- `@shapeshift-labs/studio-core/references/catalog`

Commands: `preview.reference`, `preview.removeReference`, `preview.scenario`.

### Open Preview scenarios and references

- A connected editor session.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe open-preview`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "panel.set",
    "args": {
      "panel": "references",
      "open": true
    }
  }
]
```

<a id="export"></a>
## Rendering and exports

Export portable projects, runtime modules, HTML players, SVG artwork, PNGs, GIFs, sprite sheets and frame archives.

Category: Getting started. Available in: web.

Requirements:
- Load all artwork and select a clip before rendering.

Limits:
- Video assembly uses an external encoder such as ffmpeg; it is not an MP4 export option in the live API.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/docs/live-api.md)

### Render the selected animation frame

- A connected editor with loaded artwork and a selected clip.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe export-png`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "time": {
      "type": "number",
      "default": 0,
      "description": "Frame time in seconds",
      "minimum": 0
    }
  },
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "export",
    "args": {
      "format": "png",
      "time": 0
    }
  }
]
```

### Save a portable project

- A connected editor with loaded artwork.
- These requests are not executed by discovery. Dispatch them explicitly; edits participate in undo history.

CLI: `npm run studio -- recipe export-project`

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Requests with default inputs:

```json
[
  {
    "op": "export",
    "args": {
      "format": "project"
    }
  }
]
```

<a id="image-vectorizer"></a>
## Image to SVG

Convert raster artwork into layered vector paths using the optional native Node pipeline.

Category: Conversion. Available in: web, core.

Requirements:
- Node.js and the optional native vectorizer dependencies.

Limits:
- This is a Node API, not a browser-only image conversion service.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/README.md)

Core imports:
- `@shapeshift-labs/studio-core/image-vectorizer/node`

Convert a local PNG (Node)

```js
import fs from 'node:fs/promises';
import {convert} from '@shapeshift-labs/studio-core/image-vectorizer/node';
const result = await convert(await fs.readFile('input.png'), {preset: 'cel', colors: 12});
await fs.writeFile('output.svg', result.svg);
```

<a id="video-vectorizer"></a>
## Video to tracked SVG

Convert video frames into temporally tracked vector artwork, with palette, motion and outline controls.

Category: Conversion. Available in: web, core.

Requirements:
- For conversion: Node.js, optional native dependencies, ffmpeg and ffprobe on PATH; run npm run serve:video.

Limits:
- The normal editor server opens existing vector clips; conversion uses the dedicated local service, default port 8791.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/README.md)

Core imports:
- `@shapeshift-labs/studio-core/video-vectorizer`
- `@shapeshift-labs/studio-core/video-vectorizer/node`
- `@shapeshift-labs/studio-core/video-vectorizer/silhouette-ink`

Start the conversion service

```sh
npm run build
npm run serve:video
# Open http://127.0.0.1:8791/studio/puppet-studio/video-vectorizer/
```

<a id="runtime-foundations"></a>
## Runtime foundations

Import focused math, geometry, vector rendering, deformation and validation modules without loading the editor.

Category: Reuse and runtime. Available in: web, core.

Requirements:
- Install Studio Core; renderer modules use the Three.js peer dependency.

[Documentation](https://github.com/siliconjungle/shapeshift-studio-web/blob/main/README.md)

Core imports:
- `@shapeshift-labs/studio-core/joint-transforms`
- `@shapeshift-labs/studio-core/scene3d/core/camera-motion`
- `@shapeshift-labs/studio-core/scene3d/core/composition`
- `@shapeshift-labs/studio-core/scene3d/core/deformation`
- `@shapeshift-labs/studio-core/scene3d/core/expression`
- `@shapeshift-labs/studio-core/scene3d/core/library-validation`
- `@shapeshift-labs/studio-core/scene3d/core/mirroring`
- `@shapeshift-labs/studio-core/scene3d/core/motion`
- `@shapeshift-labs/studio-core/scene3d/core/texture-upload`
- `@shapeshift-labs/studio-core/scene3d/core/uniforms`
- `@shapeshift-labs/studio-core/scene3d/core/vector-animation`
- `@shapeshift-labs/studio-core/scene3d/core/vector-art`
- `@shapeshift-labs/studio-core/scene3d/core/vector-effects`
- `@shapeshift-labs/studio-core/scene3d/core/vector-lods`
- `@shapeshift-labs/studio-core/scene3d/core/vector-validation`
- `@shapeshift-labs/studio-core/catalog`
- `@shapeshift-labs/studio-core/catalog.json`
