# Shapeshift Studio Core

Reusable ES modules for illustrated rendering, animation, entity components, and data-defined behaviour. Editor UI, content, and application rules belong to consumers.

Install from the public repository: `npm install github:siliconjungle/shapeshift-studio-core`. The existing npm distribution still requires an account granted package access.

Use focused exports such as `@shapeshift-labs/studio-core/entities/world`, `@shapeshift-labs/studio-core/entities/definitions`, and `@shapeshift-labs/studio-core/scene3d/core/renderer`. Supported exports are listed in `package.json`; internal filesystem paths are private. Three.js is a peer dependency so consumers share one renderer instance.

Entity components describe application-defined data. State machines coordinate component operations, events, and presentation through explicit bindings. Named attachment points connect effects to transforms without prescribing anatomy or gameplay meaning. Application-specific vocabulary belongs in authored schemas and recipes.

Body joins are opt-in. `body-joins` provides pose evaluation, XY deformation, and Three geometry bindings. The profile, render, and seam modules align silhouettes and preserve source paint. Canvas helpers require a browser; math and geometry imports are DOM-free. Chamfer and surface-detail modules provide textured bevels and authored shading maps.

This is proprietary software. Restricted distribution does not hide JavaScript executed in a consumer's browser.

Run `npm test` to verify the shared behavioural contracts.

## Behaviour and presentation

`EntityWorld` owns component stores, queries, and entity lifetimes. `EntityRuntime` adds schema validation and state-scoped operations. Applications define every component name, field, and entity template; the runtime does not assign meaning to those values.

```js
import { EntityRuntime } from '@shapeshift-labs/studio-core/behaviour/runtime';

const runtime = new EntityRuntime({
  version: 1,
  components: [{
    id: 'Output',
    schema: {
      type: 'object', properties: { enabled: { type: 'boolean' } },
      required: ['enabled'], additionalProperties: false
    },
    defaults: { enabled: false }
  }],
  entities: [{ id: 'device', name: 'Device', components: { Output: { enabled: false } } }]
});
const entity = runtime.create('device');
const controller = runtime.attach(entity, {
  initialState: 'idle',
  states: {
    idle: { on: { activate: [['enter', 'active']] } },
    active: {
      enter: [
        ['command', 'component.set', { component: 'Output', path: 'enabled', value: true }],
        ['schedule', 0.5, 'finish']
      ],
      exit: [['command', 'component.set', { component: 'Output', path: 'enabled', value: false }]],
      on: { finish: [['enter', 'idle']] }
    }
  }
});
runtime.dispatch(controller, 'activate');
runtime.step(0.1); // step duration must be between 0 and 0.25 seconds
```

A scene node selects `controller.library` and optionally `controller.entity`. Its presentation is independent JSON:

```json
{
  "attachments": {
    "outlet": { "position": [0, 0, 0.5], "direction": [0, 0, 1] }
  },
  "beams": [{
    "id": "ray", "origin": "outlet",
    "enabled": { "path": "components.Output.enabled" },
    "length": 3, "width": 0.04, "color": "#7dd3fc"
  }]
}
```

Attachment names are arbitrary. Each can select another scene `node`; its position and direction follow that node's transforms, mirroring, and the host's deformation projector. Multiple beams may share an attachment. The presenter also accepts explicit pose paths, object/uniform bindings, and event mappings to procedural effects or audio. The `onContact` callback reports beam intersections; consumers decide what a contact means.

State definitions support `enter`, `update`, `exit`, and `on`. `schedule` queues an event relative to the machine clock. Leaving a state cancels its timers and releases its temporary modifiers and state-owned entities. Destroying an entity cascades to its owned descendants and retires their controllers. Permanent writes use `component.set`; temporary numeric changes use `component.modify` with `add`, `multiply`, or `override`. Modifiers compose in priority/creation order over base values, so releasing one does not restore a stale copy of the data.

Other operations are `component.add`, `component.remove`, `entity.create`, `entity.destroy`, and `query`. Operations default to the current entity but may specify `entity`. `entity.create` accepts a template ID, optional `ownerComponent`, and `lifetime: "state"` (default) or `"entity"`. Component ownership ends when that component is removed. Queries select required/excluded component sets and can filter with the numeric expression interpreter using `source` and `candidate` component values. When embedding arrays or a query predicate in machine instructions, wrap literal data as `["literal", value]` so it is not compiled as a machine expression.

Machine expressions read `entity`, `components`, `parameters`, controller data, and event-local values. `command` stores a non-cleanup result in `result` for subsequent instructions in the same program. `emit` forwards an application-defined event through the runtime's host callback. There is no executable JavaScript in authored programs.

`ActionMachine.save()` serializes its data, clock, and scheduled events. It does not serialize external component stores, host resources, or cleanup callbacks. To replay a whole scene, rebuild `EntityRuntime` from its library and replay its commands and elapsed time; both editor renderers follow that approach.

## Compatibility

Version 0.2 removes the fixed gameplay/presentation contracts and character-specific presenter events. Consumers must author their own component schemas and map controller output through `presentation.attachments`, `beams`, `bindings`, and `events`. State entry/exit programs belong inside each state. Illustrated shader inputs have neutral defaults; optional emphasis inputs are `irisEmission` and `surfaceFlash`. Existing projects using the removed contracts require a data migration in their consuming application.

## Container liquid and recorded speech

- `@shapeshift-labs/studio-core/illustration/container-liquid`: deterministic sealed
  2D liquid surfaces, area-preserving fill, motion-driven slosh, settling, bubbles,
  and repeatable forward/backward timeline sampling.
- `.../illustration/tracks` and `.../illustration/effect-state`: keyed liquid fill
  and colours, validated data/state bindings, and runtime property transitions.
- `.../illustration/liquid-actions` and `.../illustration/liquid-audio`: colour
  mixing/pouring helpers and procedural liquid sound definitions.
- `@shapeshift-labs/studio-core/speech`: recorded-chunk placement, timed visemes,
  blended facial transforms, mouth-artwork selection, amplitude envelopes,
  validation, and authoring commands. `speechAt(project, clip, seconds)` samples
  the same timeline a host uses for recorded audio playback.

The liquid is a stylized sealed-container surface solver. Browser rendering,
recorded-audio playback, authoring panels and runnable examples live in
[Studio Web](https://github.com/siliconjungle/shapeshift-studio-web).

## Animation and illustration toolkit (0.3)

The public package includes the previously local tool implementations:

- `procedural/*`: particles, constraints, collision, soft bodies, dynamic ink surfaces, locomotion, limb support, attachments, sprite binding and reusable procedural rigs.
- `procedural3d/*`: terrain sampling, spatial gait planning and runtime movement.
- `noodle/*`: continuous spine deformation, lag, overshoot, stretch and volume preservation for 2D and 3D.
- `mesh` and `bone-binding`: deformable artwork meshes and weighted SVG/bone binding.
- `constraints`, `constraints/solve2d`, `constraints/solve3d`: transform, distance, IK and path constraints with animated strength.
- `joysticks`, `solos`, `draw-order`, `state-machine`: pose controls, drawing swaps, animated stacking and clip transitions.
- `shape-lab/*`: implicit shapes, contour extraction and mesh generation.
- `n-slicing`, `outline-recognition`, `vector/model`: resizable art, outline detection, animated path trimming and clipping.
- `illustration/*`: page folds, contours, colour shifts, fluid effects, container liquid, effect bindings and liquid audio.
- `speech`: recorded dialogue timing, visemes, coarticulation, envelope binding and drawing swaps.
- `scene3d/regular-solid`, `scene3d/attachment-blend` and rendering modules: regular solids, attachment blending and illustrated shading.
- `video-vectorizer`: browser-safe vector tracking and frame conversion primitives; `video-vectorizer/node` and `image-vectorizer/node`: optional native conversion pipelines.

Node conversion uses optional native dependencies. Video conversion additionally requires `ffmpeg` and `ffprobe` on PATH. Browser rendering and the animation solvers do not require those executables. Import Node conversion through its explicit `/node` entry point.

The matching editors, commands, examples and assets are in [Studio Web](https://github.com/siliconjungle/shapeshift-studio-web).
