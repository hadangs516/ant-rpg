import { RANKS, NPCS, QUESTS, DISCOVERY_LABELS } from './content.js';

const RESOURCE_KEYS = ['seed', 'dew', 'crumb', 'leaf', 'berry'];
const STAT_KEYS = ['playSeconds', 'gathered', 'dug', 'helped', 'events'];
const ACTIONS = new Set(['talk', 'gather', 'deliver', 'dig', 'care', 'rest', 'recruit', 'scout', 'defend', 'repair', 'royal']);
const NPC_IDS = new Set(NPCS.map(npc => npc.id));
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
const bounded = (value, fallback = 0, min = 0, max = 1e9) => {
  if (value === null || value === '' || typeof value === 'boolean') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
};
const integer = (value, fallback = 0, min = 0, max = 1e9) => Math.floor(bounded(value, fallback, min, max));
const rankAt = index => RANKS.reduce((rank, item, candidate) => index >= item.threshold ? candidate : rank, 0);

export function createState() {
  return {
    version: 1, rank: 0, xp: 0, questIndex: 0, questProgress: 0, completed: [],
    inventory: { seed: 0, dew: 0, crumb: 0, leaf: 0, berry: 0 },
    stats: { playSeconds: 0, gathered: 0, dug: 0, helped: 0, events: 0 },
    discoveries: [], friendships: {}, cleared: false, clearedAt: null,
    queen: { decor: 0, tributes: 0 }, world: { scene: 'nest', x: 0, y: 0, dug: 0, followers: 0, ambientWork: 0 },
    settings: { bgm: 0.35, sfx: 0.6 },
  };
}

/** Read a save as data. Rebuild known nested fields instead of spreading untrusted objects. */
export function normalizeState(raw) {
  const source = object(raw);
  const state = createState();
  const inventory = object(source.inventory), stats = object(source.stats);
  const settings = object(source.settings), world = object(source.world), queen = object(source.queen);
  if (Array.isArray(source.completed)) {
    const completed = new Set(source.completed.filter(value => typeof value === 'string'));
    while (state.questIndex < QUESTS.length && completed.has(QUESTS[state.questIndex].id)) state.questIndex++;
  } else {
    // Index-only saves from early versions can still resume; the current schema writes both fields.
    state.questIndex = integer(source.questIndex, 0, 0, QUESTS.length);
  }
  state.completed = QUESTS.slice(0, state.questIndex).map(quest => quest.id);
  state.rank = rankAt(state.questIndex);
  state.cleared = state.questIndex === QUESTS.length;
  const clearTime = typeof source.clearedAt === 'string' ? Date.parse(source.clearedAt) : NaN;
  state.clearedAt = state.cleared && Number.isFinite(clearTime) ? new Date(clearTime).toISOString() : null;
  state.xp = integer(source.xp);
  state.questProgress = integer(source.questProgress, 0, 0, getCurrentQuest(state)?.count ?? 0);
  for (const key of RESOURCE_KEYS) state.inventory[key] = integer(inventory[key], 0, 0, 99999);
  for (const key of STAT_KEYS) state.stats[key] = bounded(stats[key]);
  state.settings.bgm = bounded(settings.bgm, 0.35, 0, 1);
  state.settings.sfx = bounded(settings.sfx, 0.6, 0, 1);
  state.world.scene = world.scene === 'outside' ? 'outside' : 'nest';
  state.world.x = bounded(world.x, 0, -10000, 10000);
  state.world.y = bounded(world.y, 0, -10000, 10000);
  state.world.dug = integer(world.dug, 0, 0, 99999);
  state.world.followers = integer(world.followers, 0, 0, 5);
  state.world.ambientWork = bounded(world.ambientWork, 0, 0, 159);
  state.queen.decor = integer(queen.decor, 0, 0, 99999);
  state.queen.tributes = integer(queen.tributes, 0, 0, 99999);
  if (Array.isArray(source.discoveries)) {
    state.discoveries = [...new Set(source.discoveries.filter(value => typeof value === 'string' && value.trim()).map(value => value.slice(0, 80)))].slice(0, 200);
  }
  const friendships = object(source.friendships);
  for (const npcId of NPC_IDS) {
    if (Object.hasOwn(friendships, npcId)) state.friendships[npcId] = integer(friendships[npcId], 0, 0, 100);
  }
  return state;
}

export function getCurrentQuest(state) {
  return Number.isInteger(state?.questIndex) && state.questIndex >= 0 ? QUESTS[state.questIndex] ?? null : null;
}

export function getRank(state) {
  return RANKS[rankAt(integer(state?.questIndex, 0, 0, QUESTS.length))];
}

/** Inventory belongs to the interaction controller: count work here, never move items twice. */
export function applyAction(state, type, target, amount = 1) {
  if (!ACTIONS.has(type) || !Number.isFinite(amount) || amount < 1) return { progressed: false, completed: canCompleteQuest(state) };
  const count = Math.floor(Math.min(amount, 99999));
  const quest = getCurrentQuest(state);
  const matches = quest && quest.type === type && quest.target === target;
  if (matches) state.questProgress = Math.min(quest.count, state.questProgress + count);
  if (type === 'gather') state.stats.gathered += count;
  if (type === 'dig') state.stats.dug += count;
  if (['deliver', 'care', 'recruit', 'defend', 'repair'].includes(type)) state.stats.helped += count;
  if ((type === 'talk' || type === 'recruit') && NPC_IDS.has(target)) {
    state.friendships[target] = Math.min(100, (state.friendships[target] || 0) + 1);
  }
  const discovery = DISCOVERY_LABELS[target];
  if (discovery && !state.discoveries.includes(discovery)) state.discoveries.push(discovery);
  return { progressed: Boolean(matches), completed: canCompleteQuest(state) };
}

export function canCompleteQuest(state) {
  const quest = getCurrentQuest(state);
  return Boolean(quest && state.questProgress >= quest.count && !state.completed.includes(quest.id));
}

export function completeQuest(state) {
  const quest = getCurrentQuest(state);
  if (!canCompleteQuest(state)) return { ok: false, quest, rankUp: false, cleared: false };
  const previousRank = rankAt(state.questIndex);
  state.completed.push(quest.id);
  state.xp += quest.xp;
  state.questIndex++;
  state.questProgress = 0;
  state.rank = rankAt(state.questIndex);
  const cleared = state.questIndex === QUESTS.length && !state.cleared;
  if (cleared) {
    state.cleared = true;
    state.clearedAt = new Date().toISOString();
  }
  return { ok: true, quest, rankUp: state.rank > previousRank, cleared };
}
