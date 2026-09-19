import test from 'node:test';
import assert from 'node:assert/strict';
import { Sound } from '../src/audio.js';

class Param {
  constructor() { this.value = 1; this.calls = []; }
  call(kind, ...args) { this.calls.push([kind, ...args]); if (kind !== 'cancel') this.value = args[0]; }
  setValueAtTime(...args) { this.call('set', ...args); }
  linearRampToValueAtTime(...args) { this.call('linear', ...args); }
  exponentialRampToValueAtTime(...args) { this.call('exponential', ...args); }
  setTargetAtTime(...args) { this.call('target', ...args); }
  cancelScheduledValues(...args) { this.call('cancel', ...args); }
}
class Node {
  constructor() { this.gain = new Param(); this.frequency = new Param(); this.connections = []; this.stops = []; }
  connect(target) { this.connections.push(target); }
  disconnect() { this.disconnected = true; }
  start(time) { this.started = time; }
  stop(time) { this.stops.push(time); }
}
class Context {
  constructor() { this.currentTime = 0; this.state = 'suspended'; this.destination = {}; this.oscillators = []; }
  createGain() { return new Node(); }
  createOscillator() { const node = new Node(); this.oscillators.push(node); return node; }
  createDynamicsCompressor() { const node = new Node(); for (const key of ['threshold','knee','ratio','attack','release']) node[key] = new Param(); return node; }
  async resume() { this.state = 'running'; }
  async suspend() { this.state = 'suspended'; }
}
function sound(t) {
  const previous = globalThis.AudioContext; globalThis.AudioContext = Context;
  t.after(() => { if (previous) globalThis.AudioContext = previous; else delete globalThis.AudioContext; });
  const value = new Sound(); value.unlock(); return value;
}

test('audio mixes a full phrase through separate live volume buses and a limiter', t => {
  const s = sound(t); s.setVolumes(.65, .8); s.tick(.016, true);
  assert.ok(s.ctx.oscillators.length >= 6);
  assert.equal(s.musicBus.gain.value, .65); assert.equal(s.effectBus.gain.value, .8);
  assert.equal(s.musicBus.connections[0], s.limiter); assert.equal(s.limiter.connections[0], s.ctx.destination);
  assert.ok(s.limiter.ratio.value >= 10);
  const count = s.ctx.oscillators.length; s.setVolumes(0, 0); s.play('reward');
  assert.equal(s.ctx.oscillators.length, count); assert.equal(s.musicBus.gain.value, 0);
  s.setVolumes(4, -3); assert.equal(s.bgm, 1); assert.equal(s.sfx, 0);
});

test('themes fade former notes, do not restart at each HUD update and bound work after pauses', t => {
  const s = sound(t); s.tick(.016, true); const first = s.ctx.oscillators[0];
  s.setTheme('danger'); assert.equal(s.theme, 'danger'); assert.equal(first.stops.at(-1), .07);
  s.tick(.016, true); const step = s.step; s.setTheme('danger'); assert.equal(s.step, step);
  s.setTheme('not-a-theme'); assert.equal(s.theme, 'danger');
  for (const theme of ['depths','battle','royal','life']) { s.setTheme(theme); s.tick(.016, true); assert.equal(s.theme, theme); }
  const count = s.ctx.oscillators.length; s.ctx.currentTime += 600; s.tick(600, true);
  assert.ok(s.ctx.oscillators.length - count <= 7);
  s.suspend(); const before = s.ctx.oscillators.length; s.tick(1, true); assert.equal(s.ctx.oscillators.length, before);
  s.resume(); assert.equal(s.ctx.state, 'running'); s.tick(.1, false);
  for (const voice of [...s.voices]) voice.oscillator.onended(); assert.equal(s.voices.size, 0);
});
