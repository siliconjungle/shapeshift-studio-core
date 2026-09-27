import { EntityWorld } from '../entities/world.js';
import { validateEntityLibrary, validateValue, jsonData } from '../puppet-studio/entities/definitions.js';
import { ActionMachine } from '../puppet-studio/scene3d/core/action-machine.js';
import { evaluate } from '../puppet-studio/scene3d/core/expression.js';

const pathParts = path => {
  if (typeof path !== 'string' || !path || path.split('.').some(key => ['__proto__', 'constructor', 'prototype'].includes(key))) {
    throw Error('Invalid component field path');
  }
  return path.split('.');
};
function read(value, path) {
  for (const key of pathParts(path)) value = value?.[key];
  if (value === undefined) throw Error('Missing component field ' + path);
  return value;
}
function write(value, path, next) {
  const keys = pathParts(path);
  for (const key of keys.slice(0, -1)) {
    if (!value || !Object.hasOwn(value, key)) throw Error('Missing component field ' + path);
    value = value[key];
  }
  if (!value || !Object.hasOwn(value, keys.at(-1))) throw Error('Missing component field ' + path);
  value[keys.at(-1)] = structuredClone(next);
}

export class EntityRuntime {
  constructor(library, { emit = () => {} } = {}) {
    validateEntityLibrary(library);
    this.library = structuredClone(library);
    this.emit = emit;
    this.world = new EntityWorld(this.library.components.map(component => ({
      name: component.id,
      validate: value => { jsonData(value); validateValue(value, component.schema); return true; }
    })));
    this.controllers = new Map();
    this.modifiers = new Map();
    this.nextModifier = 1;
    this.nextController = 1;
  }

  create(templateId, owner) {
    const template = this.library.entities.find(entity => entity.id === templateId);
    if (!template) throw Error('Unknown entity template ' + templateId);
    if (owner !== undefined) this.world.assertEntity(owner);
    const entity = this.world.create(structuredClone(template.components));
    if (owner !== undefined) this.world.own(owner, entity);
    return entity;
  }

  components(entity, replacement) {
    this.world.assertEntity(entity);
    const result = Object.fromEntries([...this.world.stores].filter(([, store]) => store.has(entity))
      .map(([id, store]) => [id, structuredClone(store.get(entity))]));
    if (replacement) result[replacement.component] = structuredClone(replacement.value);
    for (const modifier of [...this.modifiers.values()].sort((a, b) => a.priority - b.priority || a.id - b.id)) {
      if (modifier.entity !== entity || !result[modifier.component]) continue;
      const current = read(result[modifier.component], modifier.path);
      const next = modifier.mode === 'add' ? current + modifier.value
        : modifier.mode === 'multiply' ? current * modifier.value : modifier.value;
      write(result[modifier.component], modifier.path, next);
    }
    for (const [name, value] of Object.entries(result)) this.world.validate(name, value);
    return result;
  }

  attach(entity, definition, parameters = {}) {
    this.world.assertEntity(entity);
    const id = this.nextController++;
    const machine = new ActionMachine(definition, {
      parameters, initialize: false,
      context: () => ({ entity, components: this.components(entity) }),
      emit: (event, data) => this.emit({ entity, controller: id, event, data }),
      execute: (operation, args, controller) => this.execute(operation, args, { entity, id, machine: controller })
    });
    this.controllers.set(id, { entity, machine });
    try { machine.reset(); } catch (error) {
      this.controllers.delete(id); machine.dispose(); throw error;
    }
    this.prune();
    return id;
  }

  execute(operation, args, owner) {
    jsonData(args);
    const entity = args.entity ?? owner.entity;
    if (operation === 'component.set') {
      const value = structuredClone(this.world.get(entity, args.component));
      write(value, args.path, args.value);
      this.world.validate(args.component, value);
      this.components(entity, { component: args.component, value });
      this.world.add(entity, args.component, value);
    } else if (operation === 'component.add') {
      this.components(entity, { component: args.component, value: args.value });
      this.world.add(entity, args.component, structuredClone(args.value));
    } else if (operation === 'component.remove') {
      this.world.remove(entity, args.component);
      this.prune();
    } else if (operation === 'component.modify') {
      const current = read(this.world.get(entity, args.component), args.path);
      if (!Number.isFinite(current) || !Number.isFinite(args.value) || !['add', 'multiply', 'override'].includes(args.mode)) {
        throw Error('Invalid numeric modifier');
      }
      if (!Number.isFinite(args.priority ?? 0)) throw Error('Invalid modifier priority');
      const id = this.nextModifier++;
      this.modifiers.set(id, { id, entity, component: args.component, path: args.path, mode: args.mode,
        value: args.value, priority: args.priority ?? 0, owner: owner.id });
      try { this.components(entity); } catch (error) { this.modifiers.delete(id); throw error; }
      return () => this.modifiers.delete(id);
    } else if (operation === 'entity.create') {
      if (args.ownerComponent && !this.world.has(entity, args.ownerComponent)) throw Error('Ownership component is absent');
      if (args.lifetime !== undefined && !['state', 'entity'].includes(args.lifetime)) throw Error('Invalid entity lifetime');
      const child = this.create(args.template, entity);
      if (args.ownerComponent) this.world.own(entity, child, { component: args.ownerComponent });
      if (args.lifetime !== 'entity') return () => this.destroy(child);
      return child;
    } else if (operation === 'entity.destroy') {
      this.destroy(entity);
    } else if (operation === 'query') {
      const source = this.components(owner.entity);
      return this.world.query(args.requires, { without: args.without ?? [] }).filter(id =>
        args.where === undefined || evaluate(args.where, { source, candidate: this.components(id), entity: id }));
    } else throw Error('Unknown component operation ' + operation);
  }

  dispatch(controller, event, data = {}) {
    const item = this.controllers.get(controller);
    if (!item) throw Error('Missing entity controller');
    item.machine.dispatch(event, data);
    this.prune();
  }

  step(dt) {
    this.prune();
    for (const [id, item] of [...this.controllers]) {
      if (this.controllers.has(id) && this.world.alive(item.entity)) item.machine.step(dt);
    }
    this.prune();
  }

  destroy(entity) { this.world.destroy(entity); this.prune(); }
  prune() {
    for (const [id, item] of this.controllers) {
      if (!this.world.alive(item.entity)) { this.controllers.delete(id); item.machine.dispose(); }
    }
    for (const [id, modifier] of this.modifiers) {
      if (!this.world.alive(modifier.entity) || !this.world.has(modifier.entity, modifier.component)) this.modifiers.delete(id);
    }
  }
  dispose() {
    const items = [...this.controllers.values()]; this.controllers.clear();
    for (const item of items) item.machine.dispose();
    this.modifiers.clear();
    for (const entity of [...this.world.entities]) this.world.destroy(entity);
  }
}
