import test from 'node:test';
import assert from 'node:assert/strict';
import { ColonyGraph, NEST_ROOMS, World } from '../src/world.js';

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const pathLength = (start, route) => route.reduce((total, point, i) => total + distance(i ? route[i - 1] : start, point), 0);
const fakeCanvas = () => ({ getContext: () => ({}), getBoundingClientRect: () => ({ width: 1200, height: 800 }) });
const inTunnel = (point, graph) => {
  if (NEST_ROOMS.some(room => ((point.x - room.x) / room.rx) ** 2 + ((point.y - room.y) / room.ry) ** 2 <= 1.01)) return true;
  return graph.edges.some(edge => {
    if (edge.locked && !graph.open) return false;
    const a = graph.nodes[edge.a], b = graph.nodes[edge.b];
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy) < 46;
  });
};

test('every room is reachable; route samples stay inside open rooms and corridors', () => {
  const graph = new ColonyGraph();
  for (const start of NEST_ROOMS) for (const target of NEST_ROOMS) {
    const route = graph.route(start, target);
    assert.ok(route.length, `${start.id} → ${target.id}`);
    assert.ok(distance(route.at(-1), target) < 1);
    let from = start;
    for (const to of route) {
      for (let step = 0; step <= 10; step++) assert.ok(inTunnel({ x: from.x + (to.x - from.x) * step / 10, y: from.y + (to.y - from.y) * step / 10 }, graph));
      from = to;
    }
  }
});

test('digging opens a genuinely shorter connected route', () => {
  const world = new World(fakeCanvas());
  const fungus = NEST_ROOMS.find(room => room.id === 'fungus'), market = NEST_ROOMS.find(room => room.id === 'market');
  const before = pathLength(fungus, world.graph.route(fungus, market));
  for (let i = 0; i < 4; i++) world.dig();
  assert.equal(world.graph.open, false);
  assert.equal(world.dig().opened, true);
  assert.equal(world.graph.open, true);
  const after = pathLength(fungus, world.graph.route(fungus, market));
  assert.ok(after < before * .8, `${after} < ${before * .8}`);
});

test('snapshot restores position, construction and followers without duplication', () => {
  const world = new World(fakeCanvas());
  world.setState({ rank: 3 }); world.setMode('outside'); world.recruit(3);
  world.player.x = 510; world.player.y = 730; world.setDug(7);
  const snapshot = world.getSnapshot();
  world.applySnapshot(snapshot); world.applySnapshot(snapshot);
  assert.deepEqual(world.getSnapshot(), snapshot);
  assert.equal(world.followers.length, 3);
  assert.equal(world.graph.open, true);
  world.applySnapshot({ scene: 'nest', x: 0, y: 0, dug: 0 });
  assert.ok(distance(world.player, { x: 1235, y: 265 }) < 1);
  assert.equal(world.graph.open, false);
});

test('resources cannot be harvested twice and return after cooldown', () => {
  const world = new World(fakeCanvas());
  const item = world.resources[0];
  assert.equal(world.consume(item.id), true);
  assert.equal(world.consume(item.id), false);
  for (let i = 0; i < 280; i++) world.update(.08);
  assert.equal(item.available, true);
});

test('guiding to another scene targets the door; direct NPC and station targets are reachable', () => {
  const world = new World(fakeCanvas(), { npcs: [{ id: '봄이', name: '봄이', room: 'entrance', role: '길잡이' }] });
  assert.equal(world.nearest().id, '봄이');
  assert.equal(world.guideTo('seed'), true);
  assert.equal(world.guide.target.id, 'exit');
  assert.ok(world.path.length);
  world.guideTo('nursery');
  assert.equal(world.guide.target.id, 'nursery');
  const destination = world.path.at(-1);
  assert.ok(distance(destination, world.nestEntities.find(entity => entity.id === 'nursery')) < 1);
  world.setMode('outside'); world.guideTo('봄이');
  assert.equal(world.guide.target.id, 'entrance');
});

test('moving follows a tunnel route until arriving without overshoot', () => {
  const world = new World(fakeCanvas());
  world.guideTo('royal');
  for (let i = 0; i < 1000 && world.path.length; i++) {
    world.update(.08);
    assert.ok(inTunnel(world.player, world.graph));
  }
  assert.equal(world.path.length, 0);
  assert.equal(world.nearest().id, 'royal');
});

test('outdoor movement is normalized and remains inside the garden', () => {
  const world = new World(fakeCanvas()); world.setMode('outside');
  world.setInput(-2, -2);
  assert.ok(Math.hypot(world.input.x, world.input.y) <= 1.000001);
  for (let i = 0; i < 500; i++) world.update(.08);
  assert.equal(world.player.x, 65); assert.equal(world.player.y, 70);
});

test('outdoor observation quest points to an outdoor station and stays interactable', () => {
  const world = new World(fakeCanvas());
  world.guideTo('scout');
  assert.equal(world.guide.target.id, 'exit');
  world.setMode('outside'); world.guideTo('scout');
  assert.equal(world.guide.target.id, 'scout');
  assert.equal(world.guide.target.scene, 'outside');
  Object.assign(world.player, { x: world.guide.target.x, y: world.guide.target.y });
  assert.equal(world.nearest().id, 'scout');
});

test('recruitment can assemble the three- and five-ant parties required by the campaign', () => {
  const world = new World(fakeCanvas());
  world.setState({ rank: 2 }); world.recruit(3);
  assert.equal(world.followers.length, 3);
  world.setState({ rank: 3 }); world.recruit(5);
  assert.equal(world.followers.length, 5);
  world.recruit(99);
  assert.equal(world.followers.length, 5);
});

test('repair and defend action events draw visible rain and a predator', () => {
  const calls = [];
  const context = new Proxy({}, { get: (target, key) => target[key] || ((...args) => calls.push([key, ...args])), set: (target, key, value) => { target[key] = value; return true; } });
  const world = new World(fakeCanvas()); world.setMode('outside');
  world.setEvent({ type: 'repair', id: '갑작스러운 소나기' }); world.drawEvent(context);
  assert.ok(calls.some(call => call[0] === 'fillRect'), 'rain overlay is drawn');
  calls.length = 0;
  world.setEvent({ type: 'defend', id: '풀숲의 방문자' }); world.drawEvent(context);
  assert.ok(calls.filter(call => call[0] === 'ellipse').length >= 8, 'predator body and eyes are drawn');
  assert.ok(calls.some(call => call[0] === 'fillText' && call[1] === '풀숲의 방문자'));
});

test('predator is an approachable fixed outdoor interaction and disappears when the event ends', () => {
  const world = new World(fakeCanvas()); world.setMode('outside');
  world.setEvent({ id: '방문자', type: 'defend', count: 6, progress: 0 });
  const original = { x: world.predator.x, y: world.predator.y };
  world.player.x += 90; world.player.y += 55;
  world.setEvent({ id: '방문자', type: 'defend', count: 6, progress: 1 });
  assert.deepEqual({ x: world.predator.x, y: world.predator.y }, original);
  assert.ok(world.predatorRecoil > 0);
  world.guideTo('guard');
  assert.equal(world.guide.target.id, 'predator');
  Object.assign(world.player, original);
  assert.equal(world.nearest().id, 'predator');
  world.setMode('nest'); world.guideTo('predator');
  assert.equal(world.guide.target.id, 'exit');
  world.setEvent(null);
  assert.equal(world.predator, null);
  assert.ok(!world.getEntities().some(entity => entity.id === 'predator'));
});
