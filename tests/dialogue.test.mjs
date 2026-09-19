import test from 'node:test';
import assert from 'node:assert/strict';
import { Typewriter } from '../src/dialogue.js';

test('dialogue types Korean and joined emoji as whole visible characters; clicks add exactly one', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const element = { textContent: '' };
  let completed = 0;
  const writer = new Typewriter(element, { text: '안녕 👩‍🌾!', interval: 32, onDone: () => completed++ }).start();
  assert.equal(element.textContent, '안');
  writer.advanceOne();
  assert.equal(element.textContent, '안녕');
  t.mock.timers.tick(32);
  assert.equal(element.textContent, '안녕 ');
  writer.advanceOne();
  assert.equal(element.textContent, '안녕 👩‍🌾');
  t.mock.timers.tick(32);
  assert.equal(element.textContent, '안녕 👩‍🌾!');
  assert.equal(completed, 1);
  writer.finish(); writer.advanceOne(); writer.start();
  t.mock.timers.tick(1000);
  assert.equal(completed, 1);
  assert.equal(writer.done, true);
});

test('closing an old dialogue prevents its timer from overwriting the next dialogue', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const element = { textContent: '' };
  let oldCompleted = false;
  const old = new Typewriter(element, { text: '이전 대화', onDone: () => { oldCompleted = true; } }).start();
  old.destroy();
  const next = new Typewriter(element, { text: '<새 대화>' }).start();
  t.mock.timers.tick(32);
  assert.equal(element.textContent, '<새');
  old.advanceOne(); old.finish(); old.start();
  next.finish();
  t.mock.timers.tick(1000);
  assert.equal(element.textContent, '<새 대화>');
  assert.equal(oldCompleted, false);
});

test('empty text and immediate finish complete once without a stray timer', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const element = { textContent: 'previous' };
  let completed = 0;
  const writer = new Typewriter(element, { onDone: () => completed++ }).start();
  assert.equal(element.textContent, '');
  assert.equal(writer.done, true);
  assert.equal(writer.timer, null);
  writer.start(); writer.finish();
  t.mock.timers.tick(1000);
  assert.equal(completed, 1);
});
