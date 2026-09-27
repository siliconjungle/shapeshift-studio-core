import test from 'node:test';
import assert from 'node:assert/strict';
import { ActionMachine } from '../src/puppet-studio/scene3d/core/action-machine.js';
import { EntityRuntime } from '../src/behaviour/runtime.js';

const controller = {
  initialState: 'idle', initial: { enabled: false },
  states: {
    idle: { on: { start: [['enter', 'running']] } },
    running: { enter: [['set', 'enabled', true], ['schedule', 0.2, 'finish']],
      exit: [['set', 'enabled', false]], on: { finish: [['enter', 'idle']], cancel: [['enter', 'idle']] } }
  }
};

test('state timers survive serialization and are cancelled when the state exits', () => {
  const machine = new ActionMachine(controller);
  machine.dispatch('start'); machine.step(0.1);
  const saved = JSON.parse(JSON.stringify(machine.save()));
  const restored = new ActionMachine(controller); restored.restore(saved);
  restored.step(0.1); assert.equal(restored.data.enabled, false);
  machine.dispatch('cancel'); machine.dispatch('start'); machine.step(0.1);
  assert.equal(machine.data.enabled, true);
  machine.step(0.1); assert.equal(machine.data.enabled, false);
});

const library = { version: 1,
  components: [{ id: 'Reading', schema: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'], additionalProperties: false }, defaults: { value: 10 } }],
  entities: [{ id: 'device', name: 'Device', components: { Reading: { value: 10 } } }]
};
const modifier = amount => ({ initialState: 'active', states: {
  active: { enter: [['command', 'component.modify', { component: 'Reading', path: 'value', mode: 'add', value: amount }]], on: { end: [['enter', 'idle']] } }, idle: {}
} });

test('scoped modifiers compose with persistent component writes and retire independently', () => {
  const runtime = new EntityRuntime(library), entity = runtime.create('device');
  const a = runtime.attach(entity, modifier(2)), b = runtime.attach(entity, modifier(3));
  assert.equal(runtime.components(entity).Reading.value, 15);
  runtime.execute('component.set', { component: 'Reading', path: 'value', value: 20 }, { entity });
  runtime.dispatch(a, 'end'); assert.equal(runtime.components(entity).Reading.value, 23);
  runtime.dispatch(b, 'end'); assert.equal(runtime.components(entity).Reading.value, 20);
  assert.throws(() => runtime.execute('component.set', { component: 'Reading', path: 'value', value: 'bad' }, { entity }));
  assert.equal(runtime.components(entity).Reading.value, 20);
});

test('owned entities and their controllers retire with their owner', () => {
  const runtime = new EntityRuntime(library), parent = runtime.create('device'), child = runtime.create('device', parent);
  const id = runtime.attach(child, modifier(2));
  runtime.destroy(parent);
  assert.equal(runtime.world.alive(child), false);
  assert.equal(runtime.controllers.has(id), false);
  assert.equal(runtime.modifiers.size, 0);
});

test('failed state entry releases resources and does not register a controller', () => {
  const runtime = new EntityRuntime(library), entity = runtime.create('device');
  assert.throws(() => runtime.attach(entity, { initialState: 'active', states: { active: { enter: [
    ['command', 'component.modify', { component: 'Reading', path: 'value', mode: 'add', value: 5 }],
    ['command', 'unknown', {}]
  ] } } }));
  assert.equal(runtime.modifiers.size, 0);
  assert.equal(runtime.controllers.size, 0);
});

test('invalid ownership is rejected before spawning and self-destruction stops execution', () => {
  const runtime = new EntityRuntime(library), entity = runtime.create('device');
  assert.throws(() => runtime.execute('entity.create', { template: 'device', ownerComponent: 'absent' }, { entity }));
  assert.equal(runtime.world.entities.size, 1);
  runtime.attach(entity, { initialState: 'active', states: { active: { enter: [
    ['command', 'entity.destroy', {}], ['command', 'component.set', { component: 'Reading', path: 'value', value: 1 }]
  ] } } });
  assert.equal(runtime.controllers.size, 0);
});

test('destroying an entity during a timed event stops the remaining frame', () => {
  const runtime = new EntityRuntime(library), entity = runtime.create('device');
  runtime.attach(entity, { initialState: 'active', states: { active: {
    enter: [['schedule', 0.05, 'finish']],
    update: [['set', 'reading', ['var', 'components.Reading.value']]],
    on: { finish: [['command', 'entity.destroy', {}]] }
  } } });
  runtime.step(0.1);
  assert.equal(runtime.world.alive(entity), false);
});

test('writes validate the effective value without leaving an invalid base behind', () => {
  const bounded = structuredClone(library);
  bounded.components[0].schema.properties.value.maximum = 25;
  const runtime = new EntityRuntime(bounded), entity = runtime.create('device');
  runtime.attach(entity, modifier(5));
  assert.throws(() => runtime.execute('component.set', { component: 'Reading', path: 'value', value: 24 }, { entity }));
  assert.equal(runtime.components(entity).Reading.value, 15);
});
