import test from 'node:test';
import assert from 'node:assert/strict';

const progression = await import('../src/progression.js').catch(() => ({}));
const content = await import('../src/content.js').catch(() => ({}));
const { createState, normalizeState, getCurrentQuest, applyAction, canCompleteQuest, completeQuest, getRank } = progression;

test('a damaged save cannot skip straight to queen or inject invalid counters', () => {
  assert.equal(typeof normalizeState, 'function', 'save normalization must be implemented');
  const state = normalizeState({ rank: 5, xp: Infinity, questIndex: 999, completed: [], questProgress: -30,
    inventory: { seed: -6, dew: '4', berry: NaN }, stats: { playSeconds: -7, gathered: Infinity },
    settings: { bgm: 12, sfx: -4 }, world: { scene: 'unknown', x: NaN, y: Infinity }, cleared: true });
  assert.equal(state.rank, 0);
  assert.equal(state.questIndex, 0);
  assert.equal(state.cleared, false);
  assert.equal(state.questProgress, 0);
  assert.equal(state.inventory.seed, 0);
  assert.equal(state.inventory.dew, 4);
  assert.equal(state.inventory.berry, 0);
  assert.equal(state.stats.playSeconds, 0);
  assert.equal(state.world.scene, 'nest');
  assert.equal(state.world.x, 0);
  assert.equal(state.world.y, 0);
  assert.equal(state.settings.bgm, 1);
  assert.equal(state.settings.sfx, 0);
});

test('missing or malformed save sections start safely with independent state objects', () => {
  assert.equal(typeof createState, 'function', 'new game state must be implemented');
  const first = createState();
  first.inventory.seed = 10;
  first.completed.push('잘못된기록');
  assert.equal(createState().inventory.seed, 0);
  for (const raw of [null, undefined, 7, [], '저장', { inventory: null, stats: [], settings: '설정', world: false }]) {
    const state = normalizeState(raw);
    assert.equal(state.inventory.seed, 0);
    assert.equal(state.stats.gathered, 0);
    assert.equal(state.rank, 0);
    assert.equal(state.settings.bgm, 0.35);
  }
});

test('talking to the wrong ant cannot complete the first quest', () => {
  assert.equal(typeof applyAction, 'function', 'quest actions must be implemented');
  const state = createState();
  applyAction(state, 'talk', '은빛');
  assert.equal(state.questProgress, 0);
  assert.equal(canCompleteQuest(state), false);
  assert.equal(completeQuest(state).ok, false);
  applyAction(state, 'talk', '봄이');
  assert.equal(canCompleteQuest(state), true);
});

test('claiming a completed quest pays once and clears progress for the next quest', () => {
  assert.equal(typeof completeQuest, 'function', 'quest rewards must be implemented');
  const state = createState();
  const quest = getCurrentQuest(state);
  applyAction(state, 'talk', '봄이');
  const result = completeQuest(state);
  assert.equal(result.ok, true);
  assert.equal(result.quest.id, quest.id);
  assert.equal(state.questIndex, 1);
  assert.equal(state.questProgress, 0);
  const awarded = state.xp;
  assert.ok(awarded > 0);
  assert.equal(completeQuest(state).ok, false);
  assert.equal(state.xp, awarded);
  assert.equal(state.completed.length, 1);
});

test('resource actions count actual work without adding or consuming inventory', () => {
  assert.equal(typeof applyAction, 'function', 'action accounting must be implemented');
  const state = createState();
  state.questIndex = 2;
  state.inventory.seed = 8;
  applyAction(state, 'gather', 'seed', 2);
  assert.equal(state.questProgress, 2);
  assert.equal(state.stats.gathered, 2);
  assert.equal(state.inventory.seed, 8);
  applyAction(state, 'gather', 'dew', 3);
  assert.equal(state.questProgress, 2);
  assert.equal(state.stats.gathered, 5);
  applyAction(state, 'gather', 'seed', -2);
  applyAction(state, 'gather', 'seed', Infinity);
  assert.equal(state.questProgress, 2);
  assert.equal(state.stats.gathered, 5);
});

test('large XP totals cannot replace mandatory promotion milestones', () => {
  assert.equal(typeof getRank, 'function', 'rank milestones must be implemented');
  const state = createState();
  state.xp = 999999;
  assert.equal(getRank(state).name, '갓 태어난 일개미');
  for (let index = 0; index < 6; index++) {
    const quest = getCurrentQuest(state);
    applyAction(state, quest.type, quest.target, quest.count);
    const result = completeQuest(state);
    assert.equal(result.rankUp, index === 5);
  }
  assert.equal(state.rank, 1);
  assert.equal(getRank(state).name, '견습 일개미');
});

test('all quests remain reachable and queen life continues after one clear', () => {
  assert.equal(typeof getCurrentQuest, 'function', 'campaign must be implemented');
  const state = createState();
  const notices = [];
  for (let index = 0; index < 30; index++) {
    const quest = getCurrentQuest(state);
    assert.ok(quest, `missing quest ${index + 1}`);
    applyAction(state, quest.type, quest.target, quest.count);
    const result = completeQuest(state);
    assert.equal(result.ok, true);
    if (result.rankUp) notices.push(index + 1);
    assert.equal(result.cleared, index === 29);
  }
  assert.deepEqual(notices, [6, 12, 18, 24, 30]);
  assert.equal(state.rank, 5);
  assert.equal(state.cleared, true);
  assert.ok(Number.isFinite(Date.parse(state.clearedAt)));
  assert.equal(getCurrentQuest(state), null);
  const before = state.stats.gathered;
  applyAction(state, 'gather', 'berry', 2);
  assert.equal(state.stats.gathered, before + 2);
  assert.equal(state.cleared, true);
  assert.equal(completeQuest(state).ok, false);
  assert.equal(normalizeState(JSON.parse(JSON.stringify(state))).rank, 5);
});

test('restoring an interrupted quest preserves its progress and real play time', () => {
  assert.equal(typeof normalizeState, 'function', 'resuming quest state must be implemented');
  const state = createState();
  applyAction(state, 'talk', '봄이');
  completeQuest(state);
  applyAction(state, 'care', 'nursery', 2);
  state.stats.playSeconds = 61.75;
  state.world = { scene: 'outside', x: 512.5, y: 214, dug: 7 };
  const restored = normalizeState(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.questIndex, 1);
  assert.equal(restored.questProgress, 2);
  assert.equal(restored.stats.playSeconds, 61.75);
  assert.equal(restored.world.scene, 'outside');
  assert.equal(restored.world.x, 512.5);
});

test('NPC relationships and discovery notes survive a save without duplicate discoveries', () => {
  assert.equal(typeof normalizeState, 'function', 'discovery and friendship persistence must be implemented');
  const state = createState();
  applyAction(state, 'talk', '봄이');
  applyAction(state, 'gather', 'seed', 1);
  applyAction(state, 'gather', 'seed', 1);
  const restored = normalizeState(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.friendships['봄이'], 1);
  assert.equal(restored.discoveries.filter(value => value === '작은 씨앗').length, 1);
});

test('every quest points to a real NPC and an actionable world target', () => {
  assert.ok(Array.isArray(content.QUESTS), 'campaign content must be implemented');
  const npcIds = new Set(content.NPCS.map(npc => npc.id));
  const targets = new Set([...npcIds, 'seed', 'dew', 'crumb', 'leaf', 'berry', 'dig', 'nursery', 'rest', 'guard', 'scout', 'royal']);
  assert.equal(npcIds.size, 15);
  assert.equal(new Set(content.QUESTS.map(quest => quest.id)).size, content.QUESTS.length);
  for (const quest of content.QUESTS) {
    assert.ok(npcIds.has(quest.npc), `${quest.title} has an unreachable giver`);
    assert.ok(targets.has(quest.target), `${quest.title} has an unreachable target`);
    assert.ok(quest.count > 0);
  }
});

test('resuming preserves the recruited squad and unfinished NPC excavation', () => {
  const state = normalizeState({ world: { scene: 'outside', followers: 3, ambientWork: 96.5 } });
  assert.equal(state.world.followers, 3);
  assert.equal(state.world.ambientWork, 96.5);
  const damaged = normalizeState({ world: { followers: 999, ambientWork: -3 } });
  assert.equal(damaged.world.followers, 5);
  assert.equal(damaged.world.ambientWork, 0);
});
