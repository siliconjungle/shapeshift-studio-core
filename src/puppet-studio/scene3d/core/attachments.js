import * as T from 'three';

const vector = (value, label) => {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) {
    throw Error('Invalid attachment ' + label);
  }
};

export function validateAttachments(definitions = {}) {
  for (const [id, definition] of Object.entries(definitions)) {
    if (!/^[a-zA-Z][\w.-]*$/.test(id) || ['constructor', 'prototype', '__proto__'].includes(id)) {
      throw Error('Invalid attachment ID');
    }
    vector(definition.position ?? [0, 0, 0], 'position');
    vector(definition.direction ?? [0, 0, 1], 'direction');
    if (!(definition.direction ?? [0, 0, 1]).some(value => value !== 0)) {
      throw Error('Attachment direction cannot be zero');
    }
    if (definition.node !== undefined && typeof definition.node !== 'string') {
      throw Error('Invalid attachment node');
    }
  }
}

export function resolveAttachment(definition, root, { objects, projectPoint } = {}) {
  const object = definition.node === undefined ? root : objects?.get(definition.node);
  if (!object) throw Error('Missing attachment node ' + definition.node);
  object.updateWorldMatrix(true, false);
  const origin = new T.Vector3(...(definition.position ?? [0, 0, 0]));
  const direction = new T.Vector3(...(definition.direction ?? [0, 0, 1])).normalize();
  // Nearby points follow the same deformation, including mirrored ancestors.
  const tip = origin.clone().addScaledVector(direction, 0.001);
  const project = point => {
    if (projectPoint) projectPoint(point, object);
    else point.applyMatrix4(object.matrixWorld);
  };
  project(origin);
  project(tip);
  return { origin, direction: tip.sub(origin).normalize() };
}
