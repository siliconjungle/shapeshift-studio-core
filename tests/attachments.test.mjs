import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { resolveAttachment } from '../src/puppet-studio/scene3d/core/attachments.js';
import { ActionPresenter } from '../src/puppet-studio/scene3d/core/action-presenter.js';
import { ActionMachine } from '../src/puppet-studio/scene3d/core/action-machine.js';

const close = (actual, expected) => assert.ok(actual.distanceTo(expected) < 1e-8, `${actual.toArray()} != ${expected.toArray()}`);

test('named attachment origins and directions follow nested, mirrored transforms', () => {
  const parent = new T.Group(), child = new T.Group(); parent.add(child);
  parent.position.set(2, 3, 4); parent.scale.set(-2, 3, 1); parent.rotation.y = Math.PI / 2;
  child.position.set(0.5, 0, 0); child.rotation.z = 0.3;
  const definition = { position: [1, 0.2, 0], direction: [1, 0, 0] };
  const actual = resolveAttachment(definition, child);
  close(actual.origin, child.localToWorld(new T.Vector3(...definition.position)));
  close(actual.direction, new T.Vector3(1, 0, 0).transformDirection(child.matrixWorld));
  const deformed = resolveAttachment(definition, child, { projectPoint(point, object) {
    point.applyMatrix4(object.matrixWorld); point.y += point.x * 2;
  } });
  close(deformed.origin, actual.origin.clone().setY(actual.origin.y + actual.origin.x * 2));
});

test('multiple beam bindings follow controller lifecycle without anatomical names', () => {
  const scene = new T.Group(), root = new T.Group(); scene.add(root);
  const machine = new ActionMachine({ initialState: 'idle', initial: { enabled: false }, states: {
    idle: { enter: [['set', 'enabled', false]], on: { activate: [['enter', 'active']] } },
    active: { enter: [['set', 'enabled', true]], exit: [['set', 'enabled', false]], on: { cancel: [['enter', 'idle']] } }
  } });
  const presenter = new ActionPresenter({ root, effectRoot: scene, definition: {
    attachments: { a: { position: [-1, 0, 0] }, b: { position: [1, 0, 0] } },
    beams: [{ id: 'one', origin: 'a', enabled: { path: 'enabled' }, length: 2 }, { id: 'two', origin: 'b', enabled: { path: 'enabled' }, length: 4 }]
  } }).attach(machine);
  presenter.applyPose(); assert.ok([...presenter.beams.values()].every(mesh => !mesh.visible));
  machine.dispatch('activate'); root.position.y = 3; presenter.applyPose();
  close(presenter.beams.get('one').position, new T.Vector3(-1, 3, 1));
  close(presenter.beams.get('two').position, new T.Vector3(1, 3, 2));
  machine.dispatch('cancel'); presenter.applyPose(); assert.ok([...presenter.beams.values()].every(mesh => !mesh.visible));
  presenter.dispose(); assert.equal(scene.children.length, 1);
});
