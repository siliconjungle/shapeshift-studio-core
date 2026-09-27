import * as T from 'three';
import { resolveAttachment, validateAttachments } from './attachments.js';

const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
function parts(path) {
  if (typeof path !== 'string' || !path || path.split('.').some(key => forbidden.has(key))) {
    throw Error('Invalid presentation path');
  }
  return path.split('.');
}
function read(data, path) {
  let value = data;
  for (const key of parts(path)) value = value?.[key];
  if (value === undefined) throw Error('Missing presentation value ' + path);
  return value;
}
function valueOf(value, data) {
  return value && typeof value === 'object' && !Array.isArray(value) && value.path
    ? read(data, value.path) : value;
}
function assign(target, key, value) {
  const current = target[key];
  if (current?.isColor) current.set(value);
  else if (current?.fromArray && Array.isArray(value)) current.fromArray(value);
  else target[key] = structuredClone(value);
}

export function validatePresentation(definition = {}) {
  validateAttachments(definition.attachments);
  if (definition.pose !== undefined) parts(definition.pose);
  for (const binding of definition.bindings ?? []) {
    parts(binding.source);
    if (!['uniform', 'object'].includes(binding.target)) throw Error('Invalid binding target');
    if (binding.target === 'uniform') parts(binding.name);
    else if (!['position', 'quaternion', 'scale', 'visible'].includes(binding.property)) {
      throw Error('Invalid object binding property');
    }
  }
  const ids = new Set();
  for (const beam of definition.beams ?? []) {
    if (typeof beam.id !== 'string' || ids.has(beam.id)) throw Error('Invalid beam ID');
    ids.add(beam.id);
    if (!Object.hasOwn(definition.attachments ?? {}, beam.origin)) throw Error('Missing beam attachment');
    for (const name of ['length', 'width', 'enabled']) {
      if (beam[name]?.path) parts(beam[name].path);
    }
  }
  for (const commands of Object.values(definition.events ?? {})) {
    if (!Array.isArray(commands)) throw Error('Presentation event needs commands');
    for (const command of commands) {
      if (!['audio.cue', 'audio.stop', 'audio.sync', 'effect.sample'].includes(command.op)) {
        throw Error('Unknown presentation operation ' + command.op);
      }
    }
  }
}

export class ActionPresenter {
  constructor({ root, uniforms = {}, visuals, audio, definition = {}, objects, projectPoint, effectRoot }) {
    validatePresentation(definition);
    Object.assign(this, { root, uniforms, visuals, audio, definition, objects, projectPoint });
    this.effects = new T.Group();
    (effectRoot ?? root).add(this.effects);
    this.beams = new Map();
    this.ray = new T.Raycaster();
    for (const beam of definition.beams ?? []) {
      const mesh = new T.Mesh(new T.CylinderGeometry(1, 1, 1, 12),
        new T.MeshBasicMaterial({ color: beam.color ?? '#ffffff', transparent: true, opacity: beam.opacity ?? 1 }));
      mesh.visible = false;
      this.effects.add(mesh);
      this.beams.set(beam.id, mesh);
    }
  }

  attach(machine) { this.machine = machine; return this; }
  pose() { return this.definition.pose ? read(this.machine.context, this.definition.pose) : null; }
  ownsUniform(name) { return this.definition.bindings?.some(binding => binding.target === 'uniform' && binding.name === name); }

  applyPose() {
    const data = this.machine.context, pose = this.pose();
    if (pose) {
      if (this.placement) this.placement.apply(this.root, pose);
      else for (const key of ['position', 'quaternion', 'scale']) this.root[key].fromArray(pose[key]);
    }
    for (const binding of this.definition.bindings ?? []) {
      const value = read(data, binding.source);
      if (binding.target === 'uniform') {
        const uniform = this.uniforms[binding.name];
        if (!uniform) throw Error('Missing uniform ' + binding.name);
        assign(uniform, 'value', value);
      } else {
        const object = binding.object ? this.visuals?.get(binding.object) : this.root;
        if (!object) throw Error('Missing presentation object');
        assign(object, binding.property, value);
      }
    }
    this.overridePose?.();
    this.updateEffects();
  }

  capturePose() {
    const pose = this.pose();
    if (pose) for (const key of ['position', 'quaternion', 'scale']) pose[key] = this.root[key].toArray();
  }

  updateEffects() {
    this.effects.updateWorldMatrix(true, false);
    const inverse = this.effects.matrixWorld.clone().invert();
    for (const definition of this.definition.beams ?? []) {
      const mesh = this.beams.get(definition.id);
      mesh.visible = !!valueOf(definition.enabled ?? true, this.machine.context);
      if (!mesh.visible) continue;
      const { origin, direction } = resolveAttachment(this.definition.attachments[definition.origin], this.root, this);
      let length = valueOf(definition.length ?? 10, this.machine.context);
      const width = valueOf(definition.width ?? 0.05, this.machine.context);
      if (!Number.isFinite(length) || length < 0 || !Number.isFinite(width) || width < 0) {
        throw Error('Beam dimensions must be finite and non-negative');
      }
      if (definition.contact && this.obstacles?.length) {
        this.ray.set(origin, direction); this.ray.far = length;
        const hit = this.ray.intersectObjects(this.obstacles, true)[0];
        if (hit) {
          length = hit.distance;
          this.onContact?.({ beam: definition.id, point: hit.point.toArray(), node: hit.object.userData.node });
        }
      }
      const end = origin.clone().addScaledVector(direction, length).applyMatrix4(inverse);
      const start = origin.clone().applyMatrix4(inverse), delta = end.clone().sub(start);
      mesh.position.copy(start).add(end).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.clone().normalize());
      mesh.scale.set(width, delta.length(), width);
    }
  }

  emit(event, args = {}) {
    for (const command of this.definition.events?.[event] ?? []) {
      const values = Object.fromEntries(Object.entries(command).map(([key, value]) =>
        [key, valueOf(value, { data: this.machine?.data, event: args })]));
      if (command.op === 'audio.cue') this.audio?.cue(values.cue, values.strength);
      if (command.op === 'audio.stop') this.audio?.stop();
      if (command.op === 'audio.sync') this.audio?.sync(values.state, values.elapsed);
      if (command.op === 'effect.sample') this.visuals?.sample(values.program, values.inputs ?? args);
    }
  }

  reset() { this.audio?.stop(); for (const mesh of this.beams.values()) mesh.visible = false; }
  dispose() {
    this.reset();
    for (const mesh of this.beams.values()) { mesh.geometry.dispose(); mesh.material.dispose(); }
    this.beams.clear(); this.effects.removeFromParent();
  }
}
