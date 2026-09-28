import { validatePresentation } from './core/action-presenter.js';
import { validateNoodles, pruneNoodles } from '../noodle/model.js';
import { validateBakedMesh } from '../shape-lab/mesh.js';
import { validateConstraints, pruneConstraints } from '../constraints/model.js';
import { validateSlicing } from '../n-slicing.js';
import { validateFields, validateReceiver } from '../../illustration/controls.js';
import { addSceneChain } from '../../procedural3d/builders.js';
import { validateProcedural3D } from '../../procedural3d/model.js';
import { pruneAppearanceTargets } from '../authoring/appearance.js';
import { validateBezier } from '../authoring/easing.js';
import { validateTools, cleanToolReferences } from '../motion-tools/core.js';
import { validateLighting, MAX_LIGHTS, LIGHT_CHANNELS, LIGHT_VECTOR_CHANNELS } from './core/lighting-definition.js';
import { validateActionMachine } from './core/action-machine.js';
import { validateCameraMotion } from './core/camera-motion.js';
import { validateFaceControl } from './core/facial-control.js';
import { validateFacialDefinition } from './core/facial-animation.js';
import { validateEffectLibrary, validateAudioLibrary } from './core/library-validation.js';
import { validateVectorEffect } from './core/vector-validation.js';
// Portable, renderer-independent scene definitions. Metres, Y up, degrees.
export const PRIMITIVES = [
  'mesh',
  'puppet',
  'group',
  'box',
  'rounded-box',
  'sphere',
  'cylinder',
  'cone',
  'plane',
  'extrude',
  'lathe',
  'svg',
];
export const FACES = ['front', 'back', 'left', 'right', 'top', 'bottom'];
export const EASINGS = ['linear', 'smooth', 'in', 'out', 'back', 'elastic', 'step', 'bezier'];
export const CHANNELS = [
  'visible',
  'position',
  'rotation',
  'scale',
  'deform.stretch',
  'deform.waist',
  'deform.bend',
  'deform.taper',
  'deform.foldAngle',
  'deform.foldAxis',
  'deform.foldOffset',
  'deform.foldWidth',
  'eye.open',
  'eye.gaze',
  'eye.tilt',
  'material.flash',
  ...LIGHT_CHANNELS,
];
export const ACTIONS = ['beam', 'impact', 'decal', 'particles', 'sound', 'shake', 'hitstop', 'face'];
export const DEFAULT_PALETTE = ['#596575', '#bc9260', '#f1ece0', '#181a20'];
export const sceneDefaults = () => ({
  version: 1,
  name: 'Illustrated scene',
  units: 'metres',
  nodes: [],
  materials: [materialDefaults('ink')],
  clips: [{ id: 'idle', name: 'Idle', duration: 6, loop: true, tracks: [], events: [] }],
  camera: { type: 'orthographic', position: [6, 4, 8], target: [0, 1, 0], size: 7, fov: 40, near: 0.05, far: 160 },
  environment: {
    background: '#1b2726',
    lightColor: '#ffe5b5',
    lightPosition: [-4, 8, 6],
    intensity: 3,
    ambient: 0.9,
    inkWeight: 1,
    shadows: true,
  },
});
export const materialDefaults = (id = 'ink') => ({
  id,
  name: 'Illustrated ink',
  palette: [...DEFAULT_PALETTE],
  bands: 3,
  roughness: 0.85,
  metalness: 0,
  relief: 0.035,
  sheen: 0.3,
  ink: 1,
  scribble: 0.13,
  flat: true,
  creases: false,
  shadeContrast: 0.3,
  shadeSoftness: 0.025,
  flash: 0,
});
// Presets are authoring data; renderers consume only the generic material fields.
export const littleGodsMaterialStyle = (material) => ({
  shading: 'svg',
  paintMode: 'source',
  preservePaint: true,
  strokeStyle: 'freehand',
  strokeVariation: 0.65,
  strokeSmoothing: 0.6,
  bands: 3,
  shadeContrast: 0.4,
  shadeSoftness: 0,
  creases: false,
  ink: 1,
  outlineUnits: 'world',
  outlineWorldWidth: 0.025,
  outlineWidth: 0.02,
  scribble: 0.08,
  palette: [...material.palette.slice(0, 3), '#161c17'],
});
export const nodeDefaults = (id, type = 'box') => ({
  id,
  name: id,
  type,
  parent: null,
  position: [0, 1, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  dimensions: [2, 2, 2],
  radius: 0.2,
  segments: 24,
  smoothOutline: true,
  material: 'ink',
  visible: true,
  castShadow: true,
  receiveShadow: true,
  deform: { stretch: 1, waist: 0, bend: [0, 0], taper: 0, foldAngle: 0, foldAxis: 0, foldOffset: 0, foldWidth: 0.4 },
  surfaces: {},
});
const assert = (v, m) => {
  if (!v) throw Error('3D scene: ' + m);
};
const number = (v, m, min = -1e5, max = 1e5) =>
  assert(typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max, 'invalid ' + m);
const vec = (v, n, m, min = -1e5, max = 1e5) => {
  assert(Array.isArray(v) && v.length === n, 'invalid ' + m);
  v.forEach((x) => number(x, m, min, max));
};
const id = (v) =>
  typeof v === 'string' &&
  /^[a-zA-Z0-9_-][a-zA-Z0-9_.-]{0,79}$/.test(v) &&
  !['__proto__', 'prototype', 'constructor'].includes(v);
const color = (v) => /^#[a-f\d]{6}$/i.test(v);
export function validateScene(s, assets = []) {
  validateFields(s?.motionFields, 3);
  for (const n of s?.nodes ?? []) validateReceiver(n.fieldReceiver);
  assert(s && s.version === 1 && s.units === 'metres', 'unsupported format');
  assert(typeof s.name === 'string' && s.name.length <= 200, 'invalid name');
  if (s.cameraMotion) validateCameraMotion(s.cameraMotion);
  for (const definition of Object.values(s.controllerLibraries ?? {})) validateActionMachine(definition);
  if (s.rendering) {
    assert(s.rendering.pipeline === 'illustrated', 'invalid illustrated pipeline');
  }
  if (s.resources) {
    assert(Array.isArray(s.resources) && s.resources.length <= 256, 'invalid resource list');
    const seen = new Set();
    for (const r of s.resources) {
      assert(id(r.id) && !seen.has(r.id), 'invalid resource ID');
      seen.add(r.id);
      assert(
        typeof r.src === 'string' &&
          /^(data:(application\/(octet-stream|json)|image\/(png|jpeg|webp))[;,]|https?:\/\/|\.\.?\/|assets\/)/i.test(r.src),
        'invalid resource source',
      );
    }
  }
  assert(s.nodes.filter((n) => n.light).length <= MAX_LIGHTS, 'maximum 16 light sources');
  assert(s.nodes.filter((n) => n.type === 'puppet').length <= 16, 'maximum 16 linked puppet instances');
  const ids = new Set(),
    mats = new Set(),
    assetIds = new Set(assets.map((a) => a.id));
  assert(Array.isArray(s.nodes) && s.nodes.length <= 256, 'maximum 256 nodes');
  assert(Array.isArray(s.materials) && s.materials.length > 0 && s.materials.length <= 128, 'invalid materials');
  for (const m of s.materials) {
    assert(id(m.id) && !mats.has(m.id), 'duplicate/invalid material');
    mats.add(m.id);
    for (const key of ['flat', 'creases'])
      if (m[key] !== undefined) assert(typeof m[key] === 'boolean', 'invalid ' + key + ' material setting');
    if (m.strokeStyle !== undefined) assert(['hull', 'freehand'].includes(m.strokeStyle), 'invalid stroke style');
    for (const key of ['strokeVariation', 'strokeSmoothing']) if (m[key] !== undefined) number(m[key], key, 0, 1);
    if (m.outlineUnits !== undefined) assert(['screen', 'object', 'world'].includes(m.outlineUnits), 'invalid outline units');
    if (m.outlineWorldWidth !== undefined) number(m.outlineWorldWidth, 'world outline width', 0, 10);
    if (m.outlineWidth !== undefined) number(m.outlineWidth, 'relative outline width', 0, 0.15);
    if (m.preservePaint !== undefined) assert(typeof m.preservePaint === 'boolean', 'invalid preserve paint');
    if (m.shading !== undefined) assert(['svg', 'solid', 'lit'].includes(m.shading), 'invalid shading mode');
    if (m.shadeContrast !== undefined) number(m.shadeContrast, 'shade contrast', 0, 1);
    if (m.shadeSoftness !== undefined) number(m.shadeSoftness, 'shade softness', 0, 0.3);
    if (m.paintMode !== undefined) assert(['source', 'palette'].includes(m.paintMode), 'invalid SVG paint mode');
    assert(Array.isArray(m.palette) && m.palette.length === 4 && m.palette.every(color), 'palette requires four hex colours');
    number(m.bands, 'bands', 2, 12);
    number(m.roughness, 'roughness', 0, 1);
    number(m.metalness, 'metalness', 0, 1);
    number(m.relief, 'relief', 0, 1);
    number(m.sheen, 'sheen', 0, 2);
    number(m.ink, 'ink', 0, 6);
    number(m.scribble, 'scribble', 0, 1);
    number(m.flash, 'flash', 0, 1);
    if (m.repeat) vec(m.repeat, 2, 'UV repeat', 0.001, 1000);
    for (const k of ['heightMap', 'roughnessMap', 'map']) if (m[k]) assert(assetIds.has(m[k]), 'missing ' + k + ' asset');
  }
  for (const n of s.nodes) {
    if (n.type === 'mesh') validateBakedMesh(n.mesh);
    if (n.trail) {
      number(n.trail.samples, 'trail copies', 1, 12);
      assert(Number.isInteger(n.trail.samples), 'integer trail copies');
      number(n.trail.seconds, 'trail duration', 0.01, 2);
      number(n.trail.alpha, 'trail opacity', 0, 1);
      number(n.trail.threshold ?? 0, 'trail speed threshold', 0, 1000);
      assert(color(n.trail.color), 'trail colour');
    }
    if (n.type === 'puppet') {
      const p = n.puppet;
      assert(p && typeof p.clip === 'string', 'puppet instance needs a clip');
      number(p.pixelsPerUnit, 'puppet pixels per metre', 1, 2000);
      number(p.speed ?? 1, 'puppet speed', 0.05, 8);
      number(p.start ?? 0, 'puppet start', 0, 120);
      number(p.offset ?? 0, 'puppet offset', 0, 120);
      assert(['fixed', 'camera', 'axis-y'].includes(p.facing ?? 'fixed'), 'invalid puppet facing');
      if (p.fit !== undefined) assert(['original', 'bounds'].includes(p.fit), 'invalid puppet fit');
      if (p.loop !== undefined) assert(typeof p.loop === 'boolean', 'invalid puppet looping');
      if (p.join !== undefined) {
        const j = p.join;
        assert(j && typeof j === 'object' && !Array.isArray(j), 'invalid puppet join');
        assert(typeof j.enabled === 'boolean', 'invalid puppet join enabled');
        if (j.target !== undefined) assert(typeof j.target === 'string', 'invalid puppet join target');
        if (j.enabled)
          assert(
            s.nodes.some(
              (t) =>
                t.id === j.target && ['box', 'rounded-box', 'sphere', 'cylinder', 'cone', 'extrude', 'lathe'].includes(t.type),
            ),
            'puppet join needs a solid body target',
          );
        if (j.end !== undefined) assert(['top', 'bottom'].includes(j.end), 'invalid puppet join end');
        if (j.length !== undefined) number(j.length, 'puppet join length', 0.001, 10);
        if (j.strength !== undefined) number(j.strength, 'puppet join strength', 0, 1);
        if (j.matchColor !== undefined) assert(typeof j.matchColor === 'boolean', 'invalid puppet join colour matching');
        if (j.inkColors !== undefined)
          assert(
            Array.isArray(j.inkColors) && j.inkColors.length <= 8 && j.inkColors.every(color),
            'invalid puppet join ink colours',
          );
      }
    }
    if (n.smoothOutline !== undefined) assert(typeof n.smoothOutline === 'boolean', 'invalid smooth outline');
    validateLighting(n);
    assert(id(n.id) && !ids.has(n.id), 'duplicate/invalid node');
    ids.add(n.id);
    assert(PRIMITIVES.includes(n.type), 'unknown primitive ' + n.type);
    assert(mats.has(n.material), 'missing material ' + n.material);
    vec(n.position, 3, 'position');
    vec(n.rotation, 3, 'rotation');
    vec(n.scale, 3, 'scale', 0.001, 1000);
    if (n.mirror !== undefined)
      assert(
        Array.isArray(n.mirror) && n.mirror.length === 2 && n.mirror.every((v) => typeof v === 'boolean'),
        'invalid mirror axes',
      );
    vec(n.dimensions, 3, 'dimensions', 0.001, 1000);
    validateSlicing(n.slicing, 3);
    if (n.slicing?.enabled)
      assert(
        !['group', 'puppet'].includes(n.type) && !n.illustration?.ground,
        'N-slicing requires a geometry object rather than a group, puppet or generated ground',
      );
    number(n.radius, 'radius', 0, 1000);
    number(n.segments, 'segments', 3, 128);
    if (n.ground !== undefined) {
      number(n.ground, 'ground height');
      assert(!n.parent, 'ground support requires a root object');
    }
    assert(Number.isInteger(n.segments), 'segments must be an integer');
    for (const [k, base, lo, hi] of [
      ['foldAngle', 0, -360, 360],
      ['foldAxis', 0, -360, 360],
      ['foldOffset', 0, -1000, 1000],
      ['foldWidth', 0.4, 0, 1000],
    ])
      number(n.deform?.[k] ?? base, k, lo, hi);
    const d = n.deform;
    assert(d, 'missing deformation');
    number(d.stretch, 'stretch', 0.15, 4);
    number(d.waist, 'waist', -0.65, 0.8);
    number(d.taper, 'taper', -0.8, 0.8);
    vec(d.bend, 2, 'bend', -3, 3);
    if (n.svg) assert(assetIds.has(n.svg), 'missing SVG ' + n.svg);
    if (['svg', 'extrude'].includes(n.type)) assert(n.svg, 'SVG primitive needs artwork');
    if (n.type === 'lathe') {
      assert(Array.isArray(n.profile) && n.profile.length >= 2 && n.profile.length <= 128, 'lathe needs a profile');
      n.profile.forEach((p) => vec(p, 2, 'profile', 0, 1000));
    }
    for (const [face, surface] of Object.entries(n.surfaces ?? {})) {
      assert(FACES.includes(face), 'invalid face');
      assert(assetIds.has(surface.asset), 'missing face art');
      for (const k of ['heightMap', 'roughnessMap', 'irisHeightMap', 'irisRoughnessMap'])
        if (surface[k]) assert(assetIds.has(surface[k]), 'missing surface map');
      if (surface.iris) assert(assetIds.has(surface.iris), 'missing iris art');
      if (surface.eye) {
        const e = surface.eye;
        vec(e.center, 2, 'eye center', -100, 100);
        assert(Array.isArray(e.contour) && e.contour.length >= 4 && e.contour.length <= 64, 'eye contour needs 4–64 landmarks');
        e.contour.forEach((p) => vec(p, 2, 'eye contour', -100, 100));
        vec(e.gaze, 2, 'gaze', -2, 2);
        number(e.open, 'eye opening', 0, 1.3);
        number(e.tilt, 'eye tilt', -1, 1);
        number(e.irisScale, 'iris scale', 0.01, 2);
      }
    }
  }
  for (const n of s.nodes) {
    if (n.effectColor !== undefined) assert(/^#[a-f\d]{6}$/i.test(n.effectColor), 'invalid effect colour');
    if (n.attachment) {
      assert(typeof n.attachment === 'string' && n.attachment.length < 100, 'invalid attachment');
      assert(s.nodes.find((p) => p.id === n.parent)?.type === 'puppet', 'joint attachments need a puppet parent');
      assert(!n.controller, 'attach controller-free objects to joints');
    }
    if (n.controller) {
      validatePresentation(n.controller.presentation);
      for (const attachment of Object.values(n.controller.presentation?.attachments ?? {}))
        if (attachment.node) assert(ids.has(attachment.node), 'missing attachment node');
      for (const kind of ['audio', 'effect']) {
        const library = n.controller.presentation?.[kind + 'Library'];
        if (library) assert(s[kind + 'Libraries']?.[library], 'missing presentation ' + kind + ' library');
      }
      assert(s.controllerLibraries?.[n.controller.library], 'missing controller library');
      validateActionMachine(s.controllerLibraries[n.controller.library], n.controller.parameters);
    }
    if (n.facial) validateFacialDefinition(n.facial);
    let p = n;
    const seen = new Set();
    while (p) {
      assert(!seen.has(p.id), 'parent cycle');
      seen.add(p.id);
      assert(seen.size <= 8, 'maximum hierarchy depth is 8');
      if (p.parent) assert(ids.has(p.parent), 'missing parent ' + p.parent);
      p = s.nodes.find((x) => x.id === p.parent);
    }
  }
  assert(Array.isArray(s.clips) && s.clips.length > 0 && s.clips.length <= 100, 'invalid clips');
  validateConstraints(s, 3);
  const clipIds = new Set();
  for (const c of s.clips) {
    if (c.controllerTimeScale !== undefined) number(c.controllerTimeScale, 'controller time scale', 0.05, 20);
    for (const [id, parameters] of Object.entries(c.controllerParameters ?? {})) {
      const n = s.nodes.find((n) => n.id === id);
      assert(n?.controller, 'missing controller for clip parameters');
      validateActionMachine(
        s.controllerLibraries[n.controller.library],
        merge(structuredClone(n.controller.parameters ?? {}), parameters),
      );
    }
    for (const a of c.controllerActions ?? []) {
      assert(ids.has(a.node), 'missing controller entity');
      const n = s.nodes.find((n) => n.id === a.node);
      const definition = s.controllerLibraries?.[n.controller?.library];
      assert(
        definition &&
          (definition.procedures?.[a.procedure] ||
            Object.values(definition.states ?? {}).some((state) => state.on?.[a.procedure])),
        'missing controller event or procedure',
      );
    }
    assert(id(c.id) && !clipIds.has(c.id), 'duplicate/invalid clip');
    clipIds.add(c.id);
    number(c.duration, 'duration', 0.1, 120);
    assert(Array.isArray(c.tracks) && c.tracks.length <= 2048, 'invalid tracks');
    const trackIds = new Set();
    for (const t of c.tracks) {
      if (t.channel === 'visible')
        assert(
          !t.program && t.keys.every((k) => [0, 1].includes(k.value) && k.easing === 'step'),
          'visibility uses 0/1 step keys',
        );
      assert(ids.has(t.node) && CHANNELS.includes(t.channel), 'invalid animation binding');
      if (LIGHT_CHANNELS.includes(t.channel))
        assert(
          s.nodes.find((n) => n.id === t.node)?.[t.channel.split('.')[0]],
          'configure light or colouring before animating it',
        );
      const key = t.node + ':' + t.channel;
      assert(!trackIds.has(key), 'duplicate track');
      trackIds.add(key);
      assert(Array.isArray(t.keys) && t.keys.length <= 10000, 'invalid keys');
      if (t.program) {
        if (t.program.parameters) for (const value of Object.values(t.program.parameters)) number(value, 'procedural parameter');
        const count = ['position', 'rotation', 'scale', ...LIGHT_VECTOR_CHANNELS].includes(t.channel)
          ? 3
          : ['deform.bend', 'eye.gaze'].includes(t.channel)
            ? 2
            : 1;
        assert(Array.isArray(t.program.values) && t.program.values.length === count, 'invalid procedural channel values');
        validateVectorEffect({
          projection: 'surface',
          curveSegments: 1,
          boundsTolerance: 0,
          surfaceOffset: 0,
          renderOrder: 0,
          color: '#ffffff',
          buckets: [{ id: 'channel', when: true }],
          animation: {
            visible: true,
            variables: t.program.variables,
            root: Object.fromEntries(t.program.values.map((v, i) => [['position.x', 'position.y', 'position.z'][i], v])),
            layers: [],
          },
        });
      }
      let prev = -1;
      for (const k of t.keys) {
        number(k.time, 'key time', 0, c.duration);
        assert(k.time > prev, 'keys must be ordered with unique times');
        prev = k.time;
        assert(EASINGS.includes(k.easing), 'invalid easing');
        validateBezier(k);
        const length = ['position', 'rotation', 'scale', ...LIGHT_VECTOR_CHANNELS].includes(t.channel)
          ? 3
          : ['deform.bend', 'eye.gaze'].includes(t.channel)
            ? 2
            : 0;
        if (length) vec(k.value, length, 'key value', t.channel === 'scale' ? 0.001 : -1e5);
        else number(k.value, 'key value');
        if (LIGHT_CHANNELS.includes(t.channel)) {
          const range = {
            'light.intensity': [0, 20],
            'light.range': [0.01, 1000],
            'light.color': [0, 1],
            'light.offset': [-1000, 1000],
            'coloring.tint': [0, 1],
            'coloring.strength': [0, 1],
            'coloring.emission': [0, 10],
            'coloring.emissionColor': [0, 1],
          }[t.channel];
          for (const value of Array.isArray(k.value) ? k.value : [k.value]) number(value, 'light/colour key', ...range);
        }
      }
    }
    assert(Array.isArray(c.events) && c.events.length <= 1000, 'invalid events');
    const events = new Set();
    for (const e of c.events) {
      assert(id(e.id) && !events.has(e.id), 'duplicate/invalid event');
      events.add(e.id);
      assert(ACTIONS.includes(e.type), 'unknown action');
      number(e.time, 'event time', 0, c.duration);
      number(e.duration, 'event duration', 0.01, 120);
      if (e.node) assert(ids.has(e.node), 'missing event node');
      if (e.faceControl) {
        assert(ids.has(e.node), 'face control needs an entity');
        validateFaceControl(e.faceControl, e.duration);
      }
      if (e.type === 'face') assert(e.faceControl, 'face event needs controls');
      if (e.worldDirection) {
        vec(e.worldDirection, 3, 'world direction');
        assert(
          e.worldDirection.some((x) => x !== 0),
          'zero world direction',
        );
      }
      if (e.effect) {
        assert(s.effectLibraries?.[e.effect.library], 'missing effect library');
        assert(ids.has(e.node), 'effect needs an emitter');
        const graph = s.effectLibraries[e.effect.library];
        for (const key of ['program', 'charge', 'fire'])
          if (e.effect[key]) assert(graph.programs?.[e.effect[key]], 'missing effect program');
      }
      if (e.audio) assert(s.audioLibraries?.[e.audio.library], 'missing audio library');
      if (e.contact) {
        assert(assetIds.has(e.contact.asset), 'missing contact artwork');
        validateVectorEffect(e.contact.vector);
      }
      for (const k of ['asset', 'impactAsset']) if (e[k]) assert(assetIds.has(e[k]), 'missing effect artwork');
      if (e.wave) assert(['sine', 'square', 'triangle', 'sawtooth'].includes(e.wave), 'invalid sound wave');
      for (const k of ['pitch', 'volume', 'amount', 'width', 'size', 'charge']) if (e[k] !== undefined) number(e[k], k, 0, 10000);
      if (e.type === 'decal') {
        assert(ids.has(e.node), 'decal needs an emitter');
        assert(assetIds.has(e.asset), 'decal needs SVG artwork');
        if (e.receiver) assert(ids.has(e.receiver), 'missing decal receiver');
        vec(e.origin ?? [0, 0, 0], 3, 'decal origin');
        vec(e.direction ?? [0, -1, 0], 3, 'decal direction');
        assert(
          (e.direction ?? [0, -1, 0]).some((x) => x !== 0),
          'decal direction cannot be zero',
        );
        number(e.length ?? 20, 'decal range', 0.001, 1000);
        number(e.offset ?? 0.006, 'decal offset', 0, 0.1);
        number(e.strength ?? 1, 'decal strength', 0, 100);
        if (e.parts) {
          number(e.parts.width, 'decal source width', 0.001, 1e5);
          number(e.parts.height, 'decal source height', 0.001, 1e5);
          assert(Array.isArray(e.parts.components) && e.parts.components.length <= 4096, 'invalid decal components');
          for (const part of e.parts.components) {
            vec(part.bounds, 4, 'decal component bounds');
            number(part.area, 'decal component area', 0, 1e10);
          }
        }
        if (e.vector) validateVectorEffect(e.vector);
      }
      if (e.type === 'beam') {
        assert(ids.has(e.node), 'beam needs an emitter');
        vec(e.origin ?? [0, 0, 1], 3, 'beam origin');
        vec(e.direction ?? [0, -0.2, 1], 3, 'beam direction');
        assert(
          (e.direction ?? [0, -0.2, 1]).some((x) => x !== 0),
          'beam direction cannot be zero',
        );
        number(e.length ?? 20, 'beam length', 0.1, 1000);
      }
      if (e.shakeMode !== undefined) assert(['replace', 'max', 'add'].includes(e.shakeMode), 'invalid shake mode');
      if (e.color) assert(color(e.color), 'invalid effect colour');
    }
  }
  if (s.sequence) {
    assert(Array.isArray(s.sequence.steps) && s.sequence.steps.length > 0 && s.sequence.steps.length <= 100, 'invalid sequence');
    for (const step of s.sequence.steps) {
      const clip = s.clips.find((c) => c.id === step.clip);
      assert(clip, 'missing sequence clip');
      if (step.parameters) for (const value of Object.values(step.parameters)) number(value, 'sequence parameter');
      number(step.from ?? 0, 'sequence start', 0, clip.duration);
      number(step.to ?? clip.duration, 'sequence end', (step.from ?? 0) + 0.001, clip.duration);
    }
  }
  for (const c of s.clips) validateTools(c.tools, s.nodes, c.duration, 3, s.clips);
  for (const definition of Object.values(s.effectLibraries ?? {})) validateEffectLibrary(definition);
  for (const definition of Object.values(s.audioLibraries ?? {})) validateAudioLibrary(definition);
  validateProcedural3D(s.procedural, s.nodes);
  validateNoodles(s, s.nodes, assets);
  const c = s.camera;
  if (c.zoom !== undefined) number(c.zoom, 'camera zoom', 0.01, 100);
  assert(['orthographic', 'perspective'].includes(c.type), 'invalid camera');
  vec(c.position, 3, 'camera position');
  vec(c.target, 3, 'camera target');
  number(c.size, 'camera size', 0.1, 1000);
  number(c.fov, 'FOV', 10, 120);
  number(c.near, 'near', 0.001, 100);
  number(c.far, 'far', c.near + 0.001, 1e5);
  const e = s.environment;
  if (e.night !== undefined) number(e.night, 'night', 0, 1);
  if (e.nightTint) vec(e.nightTint, 3, 'night tint', 0, 1);
  assert(color(e.background) && color(e.lightColor), 'invalid lighting colours');
  vec(e.lightPosition, 3, 'light position');
  number(e.intensity, 'light intensity', 0, 20);
  number(e.ambient, 'ambient', 0, 5);
  number(e.inkWeight, 'ink weight', 0, 6);
  return s;
}
export function merge(target, patch) {
  for (const [k, v] of Object.entries(patch)) {
    assert(!['__proto__', 'prototype', 'constructor'].includes(k), 'reserved field');
    if (
      v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      target[k] &&
      typeof target[k] === 'object' &&
      !Array.isArray(target[k])
    )
      merge(target[k], v);
    else target[k] = structuredClone(v);
  }
  return target;
}
function applySceneCommandImpl(project, c) {
  if (c.op === 'scene3d.replace') {
    project.scene3d = structuredClone(c.value);
    return;
  }
  if (c.op === 'scene3d.new') {
    project.scene3d = sceneDefaults();
    return;
  }
  const s = project.scene3d;
  assert(s, 'create a scene first');
  const op = c.op.replace(/^scene3d\./, '');
  if (op === 'procedural.build') {
    return addSceneChain(s, c.values).id;
  }
  if (op === 'settings') {
    merge(s, c.values);
    return;
  }
  if (op === 'asset.add') {
    assert(!project.assets.some((a) => a.id === c.id), 'duplicate asset');
    project.assets.push({ id: c.id, src: c.src });
    return c.id;
  }
  if (op === 'asset.update') {
    const a = project.assets.find((a) => a.id === c.id);
    assert(a, 'missing asset');
    a.src = c.src;
    delete a.vector;
    return c.id;
  }
  for (const [kind, key, defaults] of [
    ['node', 'nodes', () => nodeDefaults(c.id, c.type)],
    ['material', 'materials', () => materialDefaults(c.id)],
    ['clip', 'clips', () => ({ id: c.id, name: c.id, duration: 6, loop: true, tracks: [], events: [] })],
  ]) {
    if (op === kind + '.add') {
      assert(!s[key].some((x) => x.id === c.id), 'duplicate ' + kind);
      s[key].push(merge(defaults(), c.values ?? {}));
      return c.id;
    }
    if (op === kind + '.update') {
      const item = s[key].find((x) => x.id === c.id);
      assert(item, 'missing ' + kind);
      assert(!c.values?.id || c.values.id === c.id, 'IDs cannot be changed');
      merge(item, c.values);
      return c.id;
    }
    if (op === kind + '.remove') {
      assert(
        s[key].some((x) => x.id === c.id),
        'missing ' + kind,
      );
      if (kind === 'node') {
        const removed = new Set([c.id]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const n of s.nodes)
            if (removed.has(n.parent) && !removed.has(n.id)) {
              removed.add(n.id);
              changed = true;
            }
        }
        s.nodes = s.nodes.filter((n) => !removed.has(n.id));
        pruneNoodles(s);
        pruneConstraints(s, 3);
        for (const n of s.nodes)
          if (removed.has(n.puppet?.join?.target)) n.puppet.join = { ...n.puppet.join, enabled: false, target: '' };
        if (s.procedural) {
          const p = s.procedural;
          if (p.movers) p.movers = p.movers.filter((m) => ![m.node, m.target].some((id) => removed.has(id)));
          if (p.trackers) p.trackers = p.trackers.filter((t) => ![t.node, t.target, t.origin].some((id) => removed.has(id)));
          p.chains = p.chains.filter(
            (c) => ![c.root, c.target, ...c.segments, ...(c.joints ?? [])].some((id) => removed.has(id)),
          );
          const ids = new Set(p.chains.map((c) => c.id));
          p.terrains = p.terrains.filter((id) => !removed.has(id));
          p.gaits = p.gaits
            .map((g) => ({ ...g, groups: g.groups.map((group) => group.filter((id) => ids.has(id))).filter((g) => g.length) }))
            .filter((g) => g.groups.length);
          p.bodies = p.bodies
            .filter((b) => !removed.has(b.node))
            .map((b) => ({ ...b, chains: b.chains.filter((id) => ids.has(id)) }))
            .filter((b) => b.chains.length);
        }
        for (const clip of s.clips) {
          cleanToolReferences(clip, new Set(s.nodes.map((n) => n.id)));
          clip.tracks = clip.tracks.filter((t) => !removed.has(t.node));
          if (clip.resolvedTracks) clip.resolvedTracks = clip.resolvedTracks.filter((t) => !removed.has(t.node));
          clip.events = clip.events.filter((e) => !removed.has(e.node) && !removed.has(e.receiver));
          if (clip.controllerActions) clip.controllerActions = clip.controllerActions.filter((a) => !removed.has(a.node));
        }
      } else s[key] = s[key].filter((x) => x.id !== c.id);
      if (kind === 'clip')
        for (const other of s.clips)
          if (other.tools?.layers) other.tools.layers = other.tools.layers.filter((l) => l.sourceClip !== c.id);
      if (kind === 'clip' && s.sequence) {
        s.sequence.steps = s.sequence.steps.filter((step) => step.clip !== c.id);
        if (!s.sequence.steps.length) delete s.sequence;
      }
      return;
    }
  }
  if (op === 'surface.set' || op === 'surface.remove') {
    const n = s.nodes.find((n) => n.id === c.id);
    assert(n, 'missing node');
    if (op.endsWith('remove')) delete n.surfaces[c.face];
    else n.surfaces[c.face] = structuredClone(c.value);
    return;
  }
  if (op === 'key') {
    const clip = s.clips.find((x) => x.id === c.clip);
    assert(clip, 'missing clip');
    let track = clip.tracks.find((t) => t.node === c.node && t.channel === c.channel);
    if (track?.controllerOwned) {
      delete track.controllerOwned;
      delete track.program;
      track.keys = [];
    }
    assert(!track?.program, 'This channel uses a procedural program; edit its track in Scene data');
    if (!track) {
      track = { node: c.node, channel: c.channel, keys: [] };
      clip.tracks.push(track);
    }
    track.keys = track.keys.filter((k) => Math.abs(k.time - c.time) > 1e-6);
    if (!c.remove) track.keys.push({ time: c.time, value: structuredClone(c.value), easing: c.easing ?? 'smooth' });
    track.keys.sort((a, b) => a.time - b.time);
    return;
  }
  if (op === 'event.add' || op === 'event.update' || op === 'event.remove') {
    const clip = s.clips.find((x) => x.id === c.clip);
    assert(clip, 'missing clip');
    const at = clip.events.findIndex((e) => e.id === c.id);
    if (op === 'event.add') {
      assert(at < 0, 'duplicate event');
      clip.events.push({ id: c.id, type: c.type, time: 0, duration: 1, ...structuredClone(c.values ?? {}) });
    } else {
      assert(at >= 0, 'missing event');
      if (op === 'event.remove') clip.events.splice(at, 1);
      else merge(clip.events[at], c.values);
    }
    return c.id;
  }
  throw Error('Unknown 3D command ' + c.op);
}
export const sceneCapabilities = () => ({
  version: 1,
  units: 'metres',
  puppets: {
    source: 'project.puppetSources',
    binding: 'node.puppet.source',
    editable: 'project joints and clips',
    attachments: 'joint IDs in the selected source',
    default: 'current project rig',
    fit: ['original', 'bounds'],
    facing: ['fixed', 'camera', 'axis-y'],
    join: {
      field: 'node.puppet.join',
      default: 'off',
      enabled: 'boolean',
      target: 'solid body node ID; attachment end must overlap it',
      end: ['top', 'bottom'],
      length: 'metres along the puppet; default 0.15',
      strength: '0–1; default 1',
      matchColor: 'match dominant fill to target body palette; default true',
      inkColors: 'optional hex outline colours; otherwise inferred',
      operation: 'local end-cap ink repair and paint blend; source artwork preserved',
      command: 'scene3d.node.update',
    },
  },
  materials: {
    strokeStyle: ['hull', 'freehand'],
    strokeVariation: 'stable input variation',
    strokeSmoothing: 'Perfect Freehand outline filtering',
    presets: ['little-gods'],
    outlineUnits: ['world', 'screen', 'object'],
    outlineWorldWidth: 'scene units, independent of object dimensions and scale',
    outlineWidth: 'fraction of longest object dimension',
    preservePaint: 'retain source colours and shading',
    shading: ['svg', 'solid', 'lit'],
    shadeContrast: 'material.shadeContrast',
    shadeSoftness: 'material.shadeSoftness',
    creaseLines: 'material.creases',
    smoothOutline: 'node.smoothOutline',
  },
  primitives: PRIMITIVES,
  faces: FACES,
  channels: CHANNELS,
  easing: EASINGS,
  actions: ACTIONS,
  lighting: {
    maxSources: MAX_LIGHTS,
    binding: 'node.light',
    coloring: 'node.coloring',
    colorSpace: 'sRGB triples',
    presets: ['firefly', 'window', 'lantern'],
    night: 'environment.night',
    channels: LIGHT_CHANNELS,
  },
  controllers: {
    library: 'controllerLibraries',
    binding: 'node.controller',
    clipActions: 'clip.controllerActions',
    stateful: true,
    operations: ['spring', 'curve', 'axisAngle', 'qslerp', 'vrotate', 'shake'],
    parameters: 'per-instance overrides with validated editor controls',
    presentation: ['pose', 'bindings', 'attachments', 'beams', 'events'],
    lifecycle: ['enter', 'update', 'exit', 'on', 'schedule'],
    entityOperations: [
      'component.set',
      'component.add',
      'component.remove',
      'component.modify',
      'entity.create',
      'entity.destroy',
      'query',
    ],
  },
  procedural: {
    field: 'scene3d.procedural',
    dimensions: 3,
    chains: ['reach', 'follow', 'step'],
    terrain: ['box', 'sphere', 'cylinder', 'cone', 'plane'],
    bodySupport: true,
    gaitGroups: true,
    tracking: true,
    targetMovement: true,
  },
  commands: [
    'procedural.build',
    'new',
    'replace',
    'settings',
    'asset.add',
    'asset.update',
    'node.add',
    'node.update',
    'node.remove',
    'material.add',
    'material.update',
    'material.remove',
    'surface.set',
    'surface.remove',
    'clip.add',
    'clip.update',
    'clip.remove',
    'key',
    'event.add',
    'event.update',
    'event.remove',
  ].map((op) => 'scene3d.' + op),
});

export function applySceneCommand(project, command) {
  const result = applySceneCommandImpl(project, command);
  if (['scene3d.new', 'scene3d.replace', 'scene3d.node.remove', 'scene3d.material.remove'].includes(command.op))
    pruneAppearanceTargets(project);
  return result;
}
