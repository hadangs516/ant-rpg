/* A connected, living ant colony. Distances and speeds use world pixels. */
import { REGIONS, ROOM_RANKS, RANK_LABELS, GARDEN_TRAILS, GARDEN_OBSTACLES } from './regions.js';
export { REGIONS } from './regions.js';
const TAU = Math.PI * 2;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a, b, t) => a + (b - a) * t;
const COLORS = ['#b87945', '#9d603c', '#825039', '#ae6640', '#c89048', '#dfa955'];
const SIZES = [1, 1.12, 1.24, 1.35, 1.5, 1.8];
const GARDEN = REGIONS.outside;
const NEST = REGIONS.nest;
const DIG_LIMIT = 8;
const DIG_PATH = [{ x: 2210, y: 1140 }, { x: 2300, y: 1250 }, { x: 2210, y: 1400 }, { x: 2030, y: 1540 }, { x: 2175, y: 1740 }];
const NEW_ROOM = { id: 'new-room', name: '새싹의 방', x: 2175, y: 1740, rx: 195, ry: 125, decor: 'garden' };

export const NEST_ROOMS = [
  { id: 'entrance', name: '햇살 입구', x: 1220, y: 240, rx: 170, ry: 96, decor: 'entrance' },
  { id: 'nursery', name: '포근한 알방', x: 650, y: 425, rx: 188, ry: 107, decor: 'nursery' },
  { id: 'meeting', name: '만남의 광장', x: 1170, y: 535, rx: 218, ry: 117, decor: 'meeting' },
  { id: 'pantry', name: '도토리 창고', x: 1690, y: 445, rx: 193, ry: 113, decor: 'pantry' },
  { id: 'scout', name: '바람 관측소', x: 2190, y: 320, rx: 145, ry: 89, decor: 'scout' },
  { id: 'rest', name: '낮잠 쉼터', x: 295, y: 745, rx: 167, ry: 102, decor: 'rest' },
  { id: 'workshop', name: '흙손 공방', x: 825, y: 790, rx: 172, ry: 105, decor: 'workshop' },
  { id: 'guard', name: '든든한 경비실', x: 1450, y: 865, rx: 172, ry: 103, decor: 'guard' },
  { id: 'fungus', name: '달빛 버섯밭', x: 2020, y: 745, rx: 182, ry: 103, decor: 'fungus' },
  { id: 'clinic', name: '약손 치료소', x: 435, y: 1095, rx: 177, ry: 109, decor: 'clinic' },
  { id: 'library', name: '뿌리 도서관', x: 1005, y: 1170, rx: 181, ry: 105, decor: 'library' },
  { id: 'market', name: '씨앗 장터', x: 1710, y: 1180, rx: 196, ry: 109, decor: 'market' },
  { id: 'dig', name: '새 길 공사장', x: 2210, y: 1100, rx: 170, ry: 106, decor: 'dig' },
  { id: 'garden', name: '비밀 뿌리정원', x: 660, y: 1480, rx: 189, ry: 104, decor: 'garden' },
  { id: 'royal', name: '은빛 여왕의 방', x: 1335, y: 1480, rx: 237, ry: 127, decor: 'royal' },
];

const CORRIDORS = [
  ['entrance', 'meeting', [[1310, 360], [1220, 410]]],
  ['entrance', 'nursery', [[1040, 250], [965, 365], [825, 350]]],
  ['entrance', 'pantry', [[1430, 280], [1490, 405]]],
  ['nursery', 'meeting', [[845, 530], [1000, 475]]],
  ['nursery', 'rest', [[485, 510], [445, 640]]],
  ['nursery', 'workshop', [[635, 620], [755, 650]]],
  ['meeting', 'workshop', [[1090, 685], [985, 705]]],
  ['meeting', 'guard', [[1320, 650], [1300, 745]]],
  ['pantry', 'scout', [[1910, 430], [1980, 295]]],
  ['pantry', 'fungus', [[1775, 580], [1920, 610]]],
  ['pantry', 'guard', [[1600, 635], [1620, 740]]],
  ['rest', 'clinic', [[255, 900], [365, 955]]],
  ['workshop', 'clinic', [[730, 915], [565, 945]]],
  ['workshop', 'library', [[835, 995], [950, 1040]]],
  ['guard', 'library', [[1305, 1030], [1160, 1050]]],
  ['guard', 'market', [[1550, 980], [1540, 1100]]],
  ['fungus', 'dig', [[2200, 870], [2130, 990]]],
  ['market', 'dig', [[1920, 1210], [2030, 1100]]],
  ['clinic', 'garden', [[430, 1290], [560, 1340]]],
  ['library', 'garden', [[930, 1310], [785, 1335]]],
  ['library', 'royal', [[1150, 1310], [1145, 1410]]],
  ['market', 'royal', [[1620, 1350], [1510, 1360]]],
  ['garden', 'royal', [[890, 1515], [1060, 1460]]],
  ['fungus', 'market', [[1880, 935], [1775, 975]], true],
];

function seededRandom(seed) {
  let n = seed >>> 0;
  return () => { n = (n * 1664525 + 1013904223) >>> 0; return n / 4294967296; };
}

function projectSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return { x: a.x + dx * t, y: a.y + dy * t };
}

/** Workers use routes; player movement only uses the walkable geometry. */
export class ColonyGraph {
  constructor(rooms = NEST_ROOMS, corridors = CORRIDORS) {
    this.rooms = rooms;
    this.nodes = rooms.map(room => ({ ...room }));
    this.edges = [];
    for (const [from, to, bends, locked] of corridors) {
      let previous = this.nodes.findIndex(node => node.id === from);
      for (const [x, y] of bends) {
        const index = this.nodes.push({ x, y }) - 1;
        this.edges.push({ a: previous, b: index, locked: !!locked });
        previous = index;
      }
      this.edges.push({ a: previous, b: this.nodes.findIndex(node => node.id === to), locked: !!locked });
    }
    this.open = false;
  }

  snap(point) {
    const room = this.rooms.find(r => ((point.x - r.x) / (r.rx - 16)) ** 2 + ((point.y - r.y) / (r.ry - 16)) ** 2 <= 1);
    if (room) return { point: { x: point.x, y: point.y }, projection: { x: room.x, y: room.y }, room: room.id };
    let best = null;
    for (const edge of this.edges) {
      if (edge.locked && !this.open) continue;
      const projection = projectSegment(point, this.nodes[edge.a], this.nodes[edge.b]);
      const d = distance(point, projection);
      if (!best || d < best.distance) best = { point: projection, projection, edge, distance: d };
    }
    if (!best) {
      const room = this.rooms.slice().sort((a, b) => distance(a, point) - distance(b, point))[0];
      if (room) return { point: { x: room.x, y: room.y }, projection: { x: room.x, y: room.y }, room: room.id };
    }
    return best;
  }

  route(start, target) {
    const from = this.snap(start), to = this.snap(target);
    if (!from || !to) return [];
    if ((from.room && from.room === to.room) || (from.edge && from.edge === to.edge)) {
      return [to.point];
    }
    const nodes = [...this.nodes, from.projection, to.projection];
    const startIndex = nodes.length - 2, endIndex = nodes.length - 1;
    const adjacency = nodes.map(() => []);
    const connect = (a, b, weight = distance(nodes[a], nodes[b])) => {
      adjacency[a].push([b, weight]); adjacency[b].push([a, weight]);
    };
    for (const edge of this.edges) if (!edge.locked || this.open) connect(edge.a, edge.b);
    for (const [location, index] of [[from, startIndex], [to, endIndex]]) {
      if (location.room) connect(index, this.nodes.findIndex(node => node.id === location.room));
      else { connect(index, location.edge.a); connect(index, location.edge.b); }
    }
    const costs = nodes.map(() => Infinity), previous = nodes.map(() => -1), visited = new Set();
    costs[startIndex] = 0;
    for (let step = 0; step < nodes.length; step++) {
      let next = -1;
      for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && (next < 0 || costs[i] < costs[next])) next = i;
      if (next < 0 || costs[next] === Infinity || next === endIndex) break;
      visited.add(next);
      for (const [neighbor, length] of adjacency[next]) if (costs[next] + length < costs[neighbor]) {
        costs[neighbor] = costs[next] + length; previous[neighbor] = next;
      }
    }
    if (costs[endIndex] === Infinity) return [];
    const path = [];
    for (let index = endIndex; index !== startIndex; index = previous[index]) {
      if (index < 0) return [];
      path.unshift({ x: nodes[index].x, y: nodes[index].y });
    }
    if (distance(start, from.projection) > 1) path.unshift(from.projection);
    if (distance(path[path.length - 1], to.point) > 1) path.push(to.point);
    return path.filter((point, index) => index === 0 || distance(point, path[index - 1]) > 1);
  }
}

function ellipse(ctx, x, y, rx, ry, fill, angle = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, angle, 0, TAU); ctx.fillStyle = fill; ctx.fill();
}
function line(ctx, points, color, width) {
  ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
}
function label(ctx, text, x, y, color = '#e8d3ac', size = 14, align = 'center') {
  ctx.font = `600 ${size}px "Pretendard", "Noto Sans KR", system-ui, sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(text, x, y);
}
function leaf(ctx, x, y, size, color = '#81965d', angle = -0.4) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.beginPath(); ctx.moveTo(-size, 0); ctx.quadraticCurveTo(0, -size, size, 0); ctx.quadraticCurveTo(0, size, -size, 0);
  ctx.fillStyle = color; ctx.fill(); line(ctx, [[-size * .75, 0], [size * .8, 0]], '#364f32', 1.5); ctx.restore();
}
function mushroom(ctx, x, y, size = 1, color = '#c88b58') {
  line(ctx, [[x, y], [x - 2, y - 25 * size]], '#dcd0a1', 8 * size);
  ctx.beginPath(); ctx.ellipse(x - 2, y - 27 * size, 21 * size, 16 * size, 0, Math.PI, TAU);
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  ellipse(ctx, x - 9 * size, y - 32 * size, 3 * size, 2 * size, '#ecd4a0');
  ellipse(ctx, x + 7 * size, y - 34 * size, 3 * size, 2 * size, '#ecd4a0');
}

function drawAnt(ctx, ant, time, top = false, selected = false) {
  const size = ant.size || 1;
  const moving = ant.moving;
  const stride = moving ? Math.sin(time * 15 + (ant.phase || 0)) * 5 : Math.sin(time * 2 + (ant.phase || 0)) * .8;
  const gesture = ant.emote;
  const hop = gesture === '기쁨' ? Math.abs(Math.sin(time * 8)) * 12 : gesture === '격려' ? Math.abs(Math.sin(time * 5)) * 4 : 0;
  ctx.save(); ctx.translate(ant.x, ant.y - hop);
  if (gesture === '인사') ctx.rotate(Math.sin(time * 5) * .14);
  if (gesture === '위엄') ctx.scale(1.04, 1.06);
  ellipse(ctx, 0, 13 * size, 23 * size, 5 * size, '#00000025');
  if (selected) {
    ctx.save(); ctx.scale(1, top ? 1 : .55);
    ctx.beginPath(); ctx.arc(0, 14, 34 * size, 0, TAU); ctx.strokeStyle = '#e9c66d88'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  }
  if (top) ctx.rotate(ant.angle || 0);
  else ctx.scale(ant.facing || 1, 1);
  ctx.scale(size, size);
  const body = ant.color || '#9d633e';
  if (top) {
    for (let i = -1; i <= 1; i++) {
      const sway = (i % 2 ? stride : -stride);
      line(ctx, [[i * 7, 2], [i * 10 - 3, 15 + sway], [i * 14 + 4, 22 + sway]], '#4d3228', 2.4);
      line(ctx, [[i * 7, -2], [i * 10 + 3, -15 + sway], [i * 14 - 4, -22 + sway]], '#4d3228', 2.4);
    }
    if (ant.rank >= 4) {
      ellipse(ctx, -5, -14, 23, 8, '#f5e5b799', -.5); ellipse(ctx, -5, 14, 23, 8, '#f5e5b799', .5);
    }
    ellipse(ctx, -19, 0, ant.rank >= 5 ? 22 : 16, 12, body);
    ellipse(ctx, -14, -5, 9, 3, '#ffffff12');
    ellipse(ctx, 0, 0, 10, 9, body); ellipse(ctx, 17, 0, 13, 12, body);
    line(ctx, [[23, -7], [31, -12], [36, -9]], '#4d3228', 2);
    line(ctx, [[23, 7], [31, 12], [36, 9]], '#4d3228', 2);
    ellipse(ctx, 24, -6, 3, 3.5, '#fff5d7'); ellipse(ctx, 24, 6, 3, 3.5, '#fff5d7');
    ellipse(ctx, 25, -6, 1.8, 2.3, '#2c2925'); ellipse(ctx, 25, 6, 1.8, 2.3, '#2c2925');
  } else {
    for (let i = -1; i <= 1; i++) {
      line(ctx, [[i * 7, 4], [i * 9 - 4, 12 + stride * .4], [i * 13 + stride, 18]], '#4d3228', 2.5);
    }
    if (ant.rank >= 4) {
      ellipse(ctx, -7, -18, 25, 9, '#f8e8c4a8', -.65); ellipse(ctx, 4, -20, 19, 7, '#f8e8c48c', -.9);
    }
    ellipse(ctx, -22, -3, ant.rank >= 5 ? 23 : 17, 12, body, -.12);
    ellipse(ctx, -25, -7, 9, 3, '#ffffff20');
    ellipse(ctx, -3, -3, 10, 9, body); ellipse(ctx, 14, -6, 14, 13, body);
    line(ctx, [[19, -15], [23, -26 + stride * .2], [29, -27]], '#4d3228', 2);
    line(ctx, [[9, -17], [10, -26 - stride * .2], [17, -28]], '#4d3228', 2);
    ellipse(ctx, 20, -8, 4.3, 5.1, '#fff8df'); ellipse(ctx, 21.5, -7.5, 2.2, 3.2, '#252925');
    ellipse(ctx, 13, -2, 3.5, 1.8, '#df9c6b77');
    ctx.beginPath(); ctx.arc(25, -2, 3, .3, 1.8); ctx.strokeStyle = '#4d3228'; ctx.lineWidth = 1.3; ctx.stroke();
  }
  if (ant.rank >= 3 && ant.rank < 5) leaf(ctx, 0, top ? 0 : -12, 8, '#afb967', -.7);
  if (ant.rank >= 5 || ant.crown) {
    ctx.beginPath(); ctx.moveTo(5, -19); ctx.lineTo(3, -31); ctx.lineTo(11, -26); ctx.lineTo(15, -36);
    ctx.lineTo(20, -26); ctx.lineTo(27, -31); ctx.lineTo(26, -19); ctx.closePath(); ctx.fillStyle = '#f5cc72'; ctx.fill();
    ellipse(ctx, 15, -23, 2.5, 2.5, '#91ad78');
  }
  if (ant.hat === 'leaf') leaf(ctx, 14, -21, 15, '#829765', -.12);
  if (ant.hat === 'helmet') { ellipse(ctx, 13, -18, 15, 8, '#d5a952'); line(ctx, [[-2, -15], [30, -15]], '#a98441', 3); }
  if (ant.hat === 'flower') {
    for (let i = 0; i < 5; i++) ellipse(ctx, 8 + Math.cos(i * TAU / 5) * 5, -23 + Math.sin(i * TAU / 5) * 5, 3.8, 3.8, '#d3a0a1');
    ellipse(ctx, 8, -23, 3, 3, '#f6d47a');
  }
  if (ant.carry) {
    if (ant.carry === 'leaf') leaf(ctx, 0, -30, 18, '#7a9a59', -.25);
    else if (ant.carry === 'dew') ellipse(ctx, 5, -27, 8, 10, '#91c5c7');
    else ellipse(ctx, 2, -28, 12, 7, ant.carry === 'berry' ? '#af7777' : '#dec081', -.35);
  }
  ctx.restore();
}

export class World {
  constructor(canvas, { npcs = [], onNotice = () => {}, onTrespass = () => {} } = {}) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.onNotice = onNotice; this.onTrespass = onTrespass;
    this.graph = new ColonyGraph(); this.scene = 'nest'; this.time = 0; this.dug = 0; this.state = null;
    this.regionGraphs = Object.fromEntries(Object.entries(REGIONS).filter(([, region]) => region.rooms).map(([id, region]) => [id, new ColonyGraph(region.rooms, region.corridors)]));
    this.regionEntities = Object.fromEntries(Object.entries(REGIONS).map(([id, region]) => [id, region.entities.map(entity => ({ ...entity }))]));
    this.regionCaches = new Map(); this.trespassLatch = new Set(); this.releasedInput = 0; this.homeTrail = false; this.homePath = [];
    this.activity = null; this.queenCommand = false; this.guardAnts = []; this.emoteUntil = 0;
    this.player = { x: 1235, y: 265, facing: 1, angle: 0, size: 1, rank: 0, color: COLORS[0], moving: false };
    this.camera = { x: this.player.x, y: this.player.y + 30 }; this.input = { x: 0, y: 0 };
    this.path = []; this.guide = null; this.event = null; this.followers = []; this.particles = [];
    this.ambientWork = 0; this.dustTimer = 0;
    this.nestCache = null; this.gardenCache = null; this.resourceTimers = new Map(); this.spawned = false;
    this.random = seededRandom(1027); this.lastSnapshotScene = 'nest';
    this.npcs = npcs.map((npc, i) => {
      const room = NEST_ROOMS.find(r => r.id === npc.room) || NEST_ROOMS[i % NEST_ROOMS.length];
      return { ...npc, type: 'npc', x: room.x - 48, y: room.y + 12, homeX: room.x - 48, homeY: room.y + 12,
        size: npc.room === 'royal' ? 1.7 : .9 + i % 3 * .08, rank: npc.room === 'royal' ? 5 : 1,
        hat: ['leaf', 'flower', null, 'leaf', null, 'helmet', 'helmet', 'leaf', null, 'helmet', 'leaf', 'flower', 'flower', 'leaf', null][i % 15],
        facing: i % 2 ? -1 : 1, phase: i, moving: false };
    });
    const station = (kind, roomId, name, offset = 77) => {
      const room = NEST_ROOMS.find(r => r.id === roomId);
      return { id: kind, type: 'station', kind, name, x: room.x + offset, y: room.y + 22, scene: 'nest' };
    };
    this.nestEntities = [
      { id: 'exit', type: 'exit', name: '햇살 정원으로', x: 1304, y: 236, scene: 'nest' },
      station('nursery', 'nursery', '알 돌보기'), station('rest', 'rest', '잎사귀 침대'),
      station('guard', 'guard', '군락 지키기'),
      station('royal', 'royal', '여왕의 옥좌', 95),
      { id: 'dig', type: 'dig', kind: 'dig', name: '새 통로 파기', x: 2290, y: 1103, scene: 'nest' },
    ];
    this.resources = [];
    const patches = [
      ['seed', '햇살 씨앗', 900, 1180, 6], ['seed', '풀밭 씨앗', 1510, 1020, 5],
      ['dew', '맑은 이슬', 470, 1080, 5], ['dew', '잎끝 이슬', 1160, 520, 5],
      ['leaf', '부드러운 잎', 1610, 660, 6], ['leaf', '연둣빛 잎', 580, 560, 5],
      ['crumb', '과자 부스러기', 1990, 1240, 5], ['crumb', '바삭한 부스러기', 1720, 1480, 5],
      ['berry', '달콤한 열매', 2070, 470, 5], ['berry', '들딸기 열매', 530, 1570, 5],
    ];
    patches.forEach(([kind, name, x, y, count], patchIndex) => {
      for (let i = 0; i < count; i++) this.resources.push({
        id: `${kind}-${patchIndex}-${i}`, type: 'resource', kind, name, scene: 'outside',
        x: x + Math.cos(i * 2.4) * (20 + i * 17), y: y + Math.sin(i * 2.4) * (20 + i * 15),
        phase: i * 1.4 + patchIndex, available: true,
      });
    });
    this.outsideEntities = [
      { id: 'entrance', type: 'exit', name: '우리 개미굴로', x: 1210, y: 1390, scene: 'outside' },
      { id: 'scout', type: 'station', kind: 'scout', name: '정원 관측대', x: 1330, y: 690, scene: 'outside' },
      ...this.resources,
      ...this.regionEntities.outside,
    ];
    this.nestEntities.push({ id: '상점', type: 'story', appearance: 'shop', name: '씨앗 교환소', x: 1770, y: 1200, scene: 'nest' });
    const trailNodes = [], trailLinks = [], trailIndexes = new Map();
    for (const trail of GARDEN_TRAILS) {
      let previous;
      for (const [x, y] of trail) {
        const key = `${x},${y}`;
        if (!trailIndexes.has(key)) { trailIndexes.set(key, key); trailNodes.push({ id: key, x, y, rx: 18, ry: 18 }); }
        if (previous) trailLinks.push([previous, key, []]);
        previous = key;
      }
    }
    this.trailGraph = new ColonyGraph(trailNodes, trailLinks);
    const shifts = [
      ['nursery', 'pantry', 'nursery', 'rest'], ['entrance', 'pantry', 'market', 'entrance'],
      ['workshop', 'dig', 'dig', 'fungus'], ['guard', 'entrance', 'meeting', 'guard'],
      ['fungus', 'pantry', 'garden', 'fungus'], ['clinic', 'garden', 'nursery', 'clinic'],
      ['royal', 'market', 'library', 'meeting'],
    ];
    this.workers = Array.from({ length: 43 }, (_, i) => {
      const shift = shifts[i % shifts.length];
      const shiftIndex = i % shift.length;
      const room = NEST_ROOMS.find(item => item.id === shift[shiftIndex]);
      return { x: room.x + this.random() * 80 - 40, y: room.y + this.random() * 30,
        size: .55 + this.random() * .18, color: i % 4 ? '#865637' : '#a7784b', phase: i,
        facing: 1, path: [], pause: this.random() * 8, room: room.id, shift, shiftIndex, speed: 39 + this.random() * 28,
        hat: i % shifts.length === 2 ? 'helmet' : null,
        carry: ['seed', null, 'leaf', null, null, 'dew'][i % 6], moving: false };
    });
    this.gardenWorkers = Array.from({ length: 14 }, (_, i) => ({
      x: 1100 + this.random() * 200, y: 1250 + this.random() * 150, size: .65, color: '#96704a',
      phase: i, angle: 0, path: [], speed: 52 + this.random() * 16, pause: i * .7, moving: false,
      carry: i % 2 ? 'seed' : null,
    }));
    this.regionWorkers = Object.fromEntries(['depths','moss','reed','frontier'].map(scene => [scene, Array.from({length:8},(_,i)=>{
      const rooms=REGIONS[scene].rooms,room=rooms[i%rooms.length];
      return {x:room.x+i*3,y:room.y+15,size:.6+(i%3)*.07,color:'#916b46',phase:i,shiftIndex:i%rooms.length,path:[],pause:i*.7,speed:45+i*3,facing:1,carry:i%3===0?'leaf':null,hat:i%4===0?'helmet':null};
    })]));
    this.setDug(0); this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, rect.width || this.canvas.clientWidth || 1000);
    this.height = Math.max(1, rect.height || this.canvas.clientHeight || 700);
    this.dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * this.dpr); this.canvas.height = Math.round(this.height * this.dpr);
    this.zoom = this.width < 650 ? .88 : clamp(this.width / 1220, .86, 1.22);
  }

  setState(state) {
    this.state = state;
    const passageOpen = (state?.campaign?.단계 || 0) >= 3 || state?.cleared;
    if (this.passageOpen !== passageOpen) { this.passageOpen = passageOpen; this.regionCaches.delete('prison'); }
    const rank = clamp(Number(state?.rank) || 0, 0, 5);
    this.player.rank = rank; this.player.size = SIZES[rank]; this.player.color = COLORS[rank];
    if (this.dug < (Number(state?.world?.dug) || 0)) this.setDug(state.world.dug);
  }

  setMode(scene) {
    if (!REGIONS[scene] || scene === this.scene) return;
    const previous = this.scene;
    this.scene = scene; this.path = []; this.input = { x: 0, y: 0 }; this.guide = null;
    this.activity = null; this.homeTrail = false; this.homePath = []; this.trespassLatch.clear();
    const returnDoor = this.regionEntities[scene]?.find(entity => entity.destination === previous);
    Object.assign(this.player, returnDoor ? { x: returnDoor.x + 24, y: returnDoor.y + 20 } : REGIONS[scene].entry);
    this.camera.x = this.player.x; this.camera.y = this.player.y + 30;
    this.followers.forEach((follower, i) => { follower.x = this.player.x - 6 * (i + 1); follower.y = this.player.y + 10; follower.path = []; });
    this.onNotice(`${REGIONS[scene].name} · 조이스틱 또는 방향키로 이동하세요.`);
  }

  setInput(x, y) {
    const length = Math.hypot(x, y);
    this.input.x = length > 1 ? x / length : x; this.input.y = length > 1 ? y / length : y;
    if (length > .05) this.path = [];
  }

  screenToWorld(x, y) {
    return { x: (x - this.width / 2) / this.zoom + this.camera.x, y: (y - this.height * .52) / this.zoom + this.camera.y };
  }

  moveToScreen() { return false; }

  nearest() {
    const entities = this.getEntities();
    let nearest = null, closest = Infinity;
    for (const entity of entities) {
      if (entity.available === false) continue;
      const d = distance(this.player, entity);
      const radius = entity.type === 'npc' ? 92 : 106;
      if (d <= radius && d < closest) { closest = d; nearest = entity; }
    }
    return nearest;
  }

  getEntities() {
    const entities = this.scene === 'nest' ? [...this.npcs, ...this.nestEntities] : this.scene === 'outside' ? this.outsideEntities : this.regionEntities[this.scene];
    return [...entities.filter(entity => entity.available !== false && !(this.scene === 'prison' && entity.type === 'portal' && !this.passageOpen)), ...(this.predator?.scene === this.scene ? [this.predator] : [])];
  }

  guideTo() { return false; }

  currentGraph() { return this.scene === 'nest' ? this.graph : this.regionGraphs[this.scene]; }

  setActivity(entity) { this.activity = entity ? { ...entity } : null; }

  commandFollowers(enabled) {
    this.queenCommand = !!enabled && !!this.state?.cleared;
    for (const worker of this.gardenWorkers) { worker.path = []; worker.pause = 0; }
  }

  emote(name) { this.emoteName = name; this.emoteUntil = this.time + 3; }

  toggleHomeTrail() {
    if (this.scene !== 'outside') return false;
    this.homeTrail = !this.homeTrail; this.refreshHomeTrail(); return this.homeTrail;
  }

  refreshHomeTrail() {
    this.homePath = [];
    if (!this.homeTrail || this.scene !== 'outside') return;
    let best = Infinity;
    for (const edge of this.trailGraph.edges) {
      const point = projectSegment(this.player, this.trailGraph.nodes[edge.a], this.trailGraph.nodes[edge.b]);
      const steps = Math.ceil(distance(this.player, point) / 15);
      let clear = true;
      for (let i = 1; i <= steps; i++) if (!this.walkable({ x: lerp(this.player.x, point.x, i / steps), y: lerp(this.player.y, point.y, i / steps) })) { clear = false; break; }
      if (!clear) continue;
      const path = [point, ...this.trailGraph.route(point, this.outsideEntities[0])];
      const cost = path.reduce((sum, p, i) => sum + distance(i ? path[i - 1] : this.player, p), 0);
      if (cost < best) { best = cost; this.homePath = [{ x: this.player.x, y: this.player.y }, ...path]; }
    }
  }

  walkable(point, scene = this.scene) {
    if (scene === 'prison' && !this.passageOpen && point.x > 570) return false;
    if (scene === 'outside') {
      if (point.x < 65 || point.x > GARDEN.width - 65 || point.y < 70 || point.y > GARDEN.height - 70) return false;
      return !GARDEN_OBSTACLES.some(obstacle => {
        const dx = point.x - obstacle.x, dy = point.y - obstacle.y, a = obstacle.angle || 0;
        return ((dx * Math.cos(a) + dy * Math.sin(a)) / (obstacle.rx + 10)) ** 2 + ((dy * Math.cos(a) - dx * Math.sin(a)) / (obstacle.ry + 10)) ** 2 < 1;
      });
    }
    const graph = this.currentGraph();
    return graph.rooms.some(room => ((point.x - room.x) / (room.rx - 14)) ** 2 + ((point.y - room.y) / (room.ry - 14)) ** 2 <= 1)
      || graph.edges.some(edge => (!edge.locked || graph.open) && distance(point, projectSegment(point, graph.nodes[edge.a], graph.nodes[edge.b])) <= 31);
  }

  blockedRoom(point) {
    if (this.scene !== 'nest') return null;
    return NEST_ROOMS.find(room => (ROOM_RANKS[room.id] || 0) > this.player.rank && ((point.x - room.x) / (room.rx + 4)) ** 2 + ((point.y - room.y) / (room.ry + 4)) ** 2 < 1);
  }

  moveDirect(dx, dy) {
    const originalScene = this.scene, start = { x: this.player.x, y: this.player.y };
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 5));
    const canMove = point => {
      const room = this.blockedRoom(point);
      if (room) {
        if (!this.trespassLatch.has(room.id)) { this.trespassLatch.add(room.id); this.onNotice(`${room.name} · ${RANK_LABELS[ROOM_RANKS[room.id]]}부터 출입 가능`); this.onTrespass(room); }
        return false;
      }
      return this.walkable(point);
    };
    for (let i = 0; i < steps && this.scene === originalScene; i++) {
      const sx = dx / steps, sy = dy / steps;
      const both = { x: this.player.x + sx, y: this.player.y + sy };
      if (canMove(both) && this.scene === originalScene) Object.assign(this.player, both);
      else {
        if (this.scene !== originalScene) break;
        const xOnly = { x: this.player.x + sx, y: this.player.y };
        if (canMove(xOnly) && this.scene === originalScene) this.player.x = xOnly.x;
        if (this.scene !== originalScene) break;
        const yOnly = { x: this.player.x, y: this.player.y + sy };
        if (canMove(yOnly) && this.scene === originalScene) this.player.y = yOnly.y;
      }
    }
    this.player.moving = this.scene === originalScene && distance(start, this.player) > .1;
  }

  recruit(count = 2) {
    const limit = this.state?.rank >= 3 ? 5 : this.state?.rank >= 2 ? 3 : 2;
    const before = this.followers.length;
    while (this.followers.length < Math.min(limit, Math.max(0, count))) {
      const i = this.followers.length;
      this.followers.push({ x: this.player.x - 25 * (i + 1), y: this.player.y + 12, facing: 1, angle: 0,
        size: .7, color: i % 2 ? '#aa8050' : '#8b653e', phase: i + 3, path: [], repath: 0, moving: false });
    }
    return this.followers.length - before;
  }

  consume(id) {
    const resource = this.resources.find(item => item.id === id);
    if (!resource || !resource.available) return false;
    resource.available = false; this.resourceTimers.set(id, this.time + 22);
    this.player.carry = resource.kind; this.carryUntil = this.time + 2;
    this.followers.forEach(follower => { follower.carry = resource.kind === 'crumb' || resource.kind === 'berry' ? resource.kind : null; });
    this.burst(resource.x, resource.y, resource.kind === 'dew' ? '#a7dde0' : '#eccb79', 9);
    return true;
  }

  setDug(value) {
    this.dug = clamp(Number(value) || 0, 0, DIG_LIMIT);
    const open = this.dug >= DIG_LIMIT || this.state?.campaign?.개통 === true;
    this.graph = new ColonyGraph(); this.graph.open = open;
    const path = this.digPath();
    let previous = this.graph.nodes.findIndex(node => node.id === 'dig');
    for (const point of path) {
      const index = this.graph.nodes.push({ ...point }) - 1;
      this.graph.edges.push({ a: previous, b: index, locked: false }); previous = index;
    }
    if (open) { this.graph.rooms = [...NEST_ROOMS, NEW_ROOM]; Object.assign(this.graph.nodes[previous], NEW_ROOM); }
    Object.assign(this.nestEntities.find(entity => entity.id === 'dig'), path.at(-1));
    this.nestEntities.find(entity => entity.id === 'dig').name = open ? '새싹의 방 보강하기' : '새 통로 파기';
    this.nestCache = null;
  }

  digPath(progress = this.graph.open ? 1 : this.dug / DIG_LIMIT) {
    let length = 0;
    for (let i = 1; i < DIG_PATH.length; i++) length += distance(DIG_PATH[i - 1], DIG_PATH[i]);
    let remaining = length * progress;
    const path = [{ ...DIG_PATH[0] }];
    for (let i = 1; i < DIG_PATH.length && remaining > 0; i++) {
      const a = DIG_PATH[i - 1], b = DIG_PATH[i], segment = distance(a, b), fraction = Math.min(1, remaining / segment);
      path.push({ x: lerp(a.x, b.x, fraction), y: lerp(a.y, b.y, fraction) }); remaining -= segment;
    }
    return path;
  }

  dig() {
    const spot = this.nestEntities.find(entity => entity.id === 'dig');
    if (this.scene !== 'nest' || distance(this.player, spot) > 115 || this.graph.open) return { dug: this.dug, opened: false };
    this.setDug(this.dug + 1); this.digAnimation = 1.3;
    this.burst(spot.x + 40, spot.y + 10, '#b4865b', 16);
    const opened = this.dug === DIG_LIMIT;
    if (opened) { if (this.state?.campaign) this.state.campaign.개통 = true; this.onNotice('직접 개통했어요! 새싹의 방과 버섯밭 지름길이 열렸어요.'); }
    return { dug: this.dug, opened };
  }

  setEvent(event) {
    const previousKey = this.event && (this.event.id || this.event.type || this.event);
    const nextKey = event && (event.id || event.type || event);
    const kind = typeof event === 'string' ? event : `${event?.kind || ''} ${event?.type || ''} ${event?.id || ''}`;
    if (event && /predator|beetle|spider|defend|포식|거미|딱정/.test(kind)) {
      if (!this.predator || previousKey !== nextKey) {
        const origin = this.scene === 'outside' ? this.player : { x: 1210, y: 1510 };
        const spawn = Array.from({length:8},(_,i)=>({x:clamp(origin.x+Math.cos(i*TAU/8-.5)*190,150,GARDEN.width-150),y:clamp(origin.y+Math.sin(i*TAU/8-.5)*190,150,GARDEN.height-150)})).find(point=>this.walkable(point,'outside')) || REGIONS.outside.entry;
        this.predator = { id: 'predator', type: 'station', kind: 'guard', name: '포식자 밀어내기',
          ...spawn, scene: 'outside' };
        this.lastEventProgress = 0;
        this.guardAnts = Array.from({ length: 4 }, (_, i) => ({ x: 1210 + i * 12, y: 1390, scene: 'outside', size: .85, hat: 'helmet', rank: 2, color: '#956442', phase: i, path: [], repath: 0, moving: false }));
      }
      const progress = Number(event.progress) || 0;
      if (progress > (this.lastEventProgress || 0)) {
        this.predatorRecoil = .6; this.burst(this.predator.x, this.predator.y + 25, '#e6d094', 12);
      }
      this.lastEventProgress = progress;
    } else { this.predator = null; this.predatorRecoil = 0; this.guardAnts = []; }
    this.event = event;
    if (event && previousKey !== nextKey) this.eventStarted = this.time;
  }

  getSnapshot() {
    return { scene: this.scene, x: Math.round(this.player.x), y: Math.round(this.player.y), dug: this.dug, followers: this.followers.length, ambientWork: Math.round(this.ambientWork) };
  }

  applySnapshot(data) {
    if (!data || !Number.isFinite(Number(data.x)) || !Number.isFinite(Number(data.y))) return;
    this.setDug(data.dug || 0); this.ambientWork = clamp(Number(data.ambientWork) || 0, 0, 159);
    this.scene = REGIONS[data.scene] ? data.scene : 'nest';
    const x = Number(data.x), y = Number(data.y);
    const point = x === 0 && y === 0 ? (this.scene === 'nest' ? { x: 1235, y: 265 } : REGIONS[this.scene].entry) : { x, y };
    if (this.scene !== 'outside') Object.assign(this.player, this.walkable(point) ? point : this.currentGraph().snap(point).point);
    else Object.assign(this.player, this.walkable(point) ? point : REGIONS.outside.entry);
    // Existing saves may stand in a room newly restricted by this update.
    if (this.blockedRoom(this.player) || !this.walkable(this.player)) Object.assign(this.player, this.scene === 'nest' ? { x: 1235, y: 265 } : REGIONS[this.scene].entry);
    this.path = []; this.followers = []; this.camera.x = this.player.x; this.camera.y = this.player.y + 30;
    this.recruit(clamp(Number(data.followers) || 0, 0, 5));
    this.commandFollowers(this.state?.campaign?.집결);
  }

  burst(x, y, color, count) {
    for (let i = 0; i < count; i++) this.particles.push({ x, y, vx: (this.random() - .5) * 110, vy: -20 - this.random() * 75, life: .65 + this.random() * .35, color, size: 2 + this.random() * 3 });
    if (this.particles.length > 70) this.particles.splice(0, this.particles.length - 70);
  }

  moveAlong(actor, path, speed, dt, top = false) {
    let remaining = speed * dt; actor.moving = path.length > 0;
    while (path.length && remaining > 0) {
      const target = path[0], d = distance(actor, target);
      if (d < 1) { path.shift(); continue; }
      const amount = Math.min(d, remaining), dx = (target.x - actor.x) / d, dy = (target.y - actor.y) / d;
      actor.x += dx * amount; actor.y += dy * amount; remaining -= amount;
      if (Math.abs(dx) > .05) actor.facing = dx >= 0 ? 1 : -1;
      if (top) actor.angle = Math.atan2(dy, dx);
      if (amount >= d) path.shift();
    }
  }

  update(dt) {
    const elapsed = clamp(dt, 0, 1);
    dt = clamp(dt, 0, .08); this.time += dt;
    if (this.predatorRecoil > 0) this.predatorRecoil = Math.max(0, this.predatorRecoil - dt);
    if (!this.graph.open && this.dug < DIG_LIMIT - 1) {
      this.ambientWork += elapsed;
      if (this.ambientWork >= 160) {
        this.ambientWork -= 160; this.setDug(this.dug + 1);
        if (this.dug === DIG_LIMIT - 1) this.onNotice('굴착조가 마지막 흙벽 앞에 도착했어요. 공사장에서 직접 개통해 주세요.');
      }
    }
    if (this.digAnimation > 0) this.digAnimation -= dt;
    const speed = 185 + this.player.rank * 10 + (this.state?.campaign?.강화?.이동 || 0) * 15;
    const inputLength = Math.hypot(this.input.x, this.input.y);
    if (inputLength > .05) {
      this.releasedInput = 0;
      const dx = this.input.x * speed * dt, dy = this.input.y * speed * dt;
      this.moveDirect(this.scene === 'outside' ? clamp(this.player.x + dx, 65, GARDEN.width - 65) - this.player.x : dx,
        this.scene === 'outside' ? clamp(this.player.y + dy, 70, GARDEN.height - 70) - this.player.y : dy);
      this.player.angle = Math.atan2(this.input.y, this.input.x);
      if (Math.abs(this.input.x) > .1) this.player.facing = this.input.x >= 0 ? 1 : -1;
    } else { this.player.moving = false; this.releasedInput += dt; if (this.releasedInput > .65) this.trespassLatch.clear(); }
    this.path = [];
    for (const id of this.trespassLatch) {
      const room = NEST_ROOMS.find(item => item.id === id);
      if (distance(this.player, room) > room.rx + 100) this.trespassLatch.delete(id);
    }
    for (const [id, until] of this.resourceTimers) if (this.time >= until) {
      this.resources.find(resource => resource.id === id).available = true; this.resourceTimers.delete(id);
    }
    if (this.time > this.carryUntil) { this.player.carry = null; this.followers.forEach(follower => { follower.carry = null; }); }
    if (this.scene === 'nest') {
      for (const [i, npc] of this.npcs.entries()) {
        const nextX = npc.homeX + Math.sin(this.time * .17 + i * 2) * 13;
        npc.moving = Math.abs(nextX - npc.x) > .008; npc.facing = nextX >= npc.x ? 1 : -1; npc.x = nextX;
      }
      for (const worker of this.workers) {
        if (!worker.path.length) {
          worker.pause -= dt;
          if (worker.pause <= 0) {
            worker.shiftIndex = (worker.shiftIndex + 1) % worker.shift.length;
            const room = NEST_ROOMS.find(item => item.id === worker.shift[worker.shiftIndex]);
            worker.path = this.graph.route(worker, { x: room.x + this.random() * 90 - 45, y: room.y + 10 + this.random() * 20 });
            worker.pause = (room.id === 'dig' ? 12 : 3) + this.random() * 8; worker.room = room.id;
            if (room.id === 'pantry') worker.carry = 'seed';
            else if (room.id === 'garden' || room.id === 'nursery') worker.carry = 'leaf';
            else if (room.id === 'entrance' || room.id === 'dig') worker.carry = null;
          }
        }
        this.moveAlong(worker, worker.path, worker.speed, dt);
      }
      this.dustTimer -= dt;
      if (this.dustTimer <= 0) {
        this.dustTimer = .7;
        for (const worker of this.workers) if (worker.room === 'dig' && !worker.path.length && this.visible(worker.x, worker.y)) {
          this.burst(worker.x + 20, worker.y + 8, '#aa8057', 2);
        }
      }
    } else if (this.scene === 'outside') {
      for (const [i, worker] of this.gardenWorkers.entries()) {
        if (this.queenCommand) {
          const angle = i * 2.4, radius = 65 + Math.floor(i / 5) * 25;
          const target = { x: this.player.x + Math.cos(angle) * radius, y: this.player.y + Math.sin(angle) * radius };
          worker.path = distance(worker, target) > 25 ? [target] : [];
          this.moveAlong(worker, worker.path, speed + 10, dt, true); continue;
        }
        if (!worker.path.length) {
          worker.pause -= dt;
          if (worker.pause <= 0) {
            const resource = this.resources[(i * 3) % this.resources.length];
            const home = distance(worker, this.outsideEntities[0]) < 170;
            worker.path = [home ? { x: resource.x, y: resource.y } : { x: 1210 + this.random() * 45, y: 1390 + this.random() * 35 }];
            worker.carry = home ? null : resource.kind; worker.pause = 2 + this.random() * 4;
          }
        }
        this.moveAlong(worker, worker.path, worker.speed, dt, true);
      }
    }
    for (const worker of this.regionWorkers[this.scene] || []) {
      if (!worker.path.length) {
        worker.pause -= dt;
        if (worker.pause <= 0) {
          const rooms=REGIONS[this.scene].rooms;worker.shiftIndex=(worker.shiftIndex+1)%rooms.length;
          const room=rooms[worker.shiftIndex];worker.path=this.currentGraph().route(worker,{x:room.x,y:room.y+18});worker.pause=3+this.random()*4;
        }
      }
      this.moveAlong(worker,worker.path,worker.speed,dt);
    }
    this.followers.forEach((follower, i) => {
      const preceding = this.activity ? { x: this.activity.x + Math.cos(i * 2.4 + this.time * .7) * 26, y: this.activity.y + Math.sin(i * 2.4 + this.time * .7) * 20 } : i ? this.followers[i - 1] : this.player;
      const d = distance(follower, preceding); follower.repath -= dt;
      if (d > (this.activity ? 5 : 60) && follower.repath <= 0) {
        follower.path = this.scene !== 'outside' ? this.currentGraph().route(follower, preceding) : [{ x: preceding.x, y: preceding.y }];
        follower.repath = this.activity ? .12 : .45;
      }
      if (d <= (this.activity ? 4 : 48)) follower.path = [];
      if (this.activity) follower.carry = this.activity.kind || 'seed';
      this.moveAlong(follower, follower.path, speed + 17, dt, this.scene === 'outside');
    });
    if (this.predator) {
      const remaining = Number(this.event?.remaining ?? 180);
      if (remaining < 20 && this.predator.scene === 'outside') {
        Object.assign(this.predator, { x: 1250, y: 255, scene: 'nest' });
        this.guardAnts.forEach((ant, i) => { Object.assign(ant, { x: 1300 + i * 10, y: 270, scene: 'nest', path: [] }); });
      }
      if (remaining < 55 && this.predator.scene === 'outside') this.moveAlong(this.predator, [{ x: 1210, y: 1390 }], 90, dt, true);
      else if (this.predator.scene === 'nest') {
        if (!this.predator.path?.length) this.predator.path = this.graph.route(this.predator, NEST_ROOMS.find(room => room.id === 'meeting'));
        this.moveAlong(this.predator, this.predator.path, 24, dt);
      }
      this.guardAnts.forEach((ant, i) => {
        ant.repath -= dt;
        const angle = i * TAU / 4 + Math.sin(this.time * 3 + i) * .12;
        const target = { x: this.predator.x + Math.cos(angle) * 72, y: this.predator.y + Math.sin(angle) * 55 };
        if (ant.repath <= 0) { ant.path = ant.scene === 'nest' ? this.graph.route(ant, target) : [target]; ant.repath = .3; }
        this.moveAlong(ant, ant.path, 165, dt, ant.scene === 'outside');
        if (distance(ant, this.predator) < 95) { ant.moving = true; if (Math.floor(this.time * 5 + i) !== ant.lastHit) { ant.lastHit = Math.floor(this.time * 5 + i); this.burst(ant.x, ant.y, '#e4c874', 1); } }
      });
    }
    if (this.homeTrail && (!this.nextTrailUpdate || this.time > this.nextTrailUpdate)) { this.refreshHomeTrail(); this.nextTrailUpdate = this.time + .6; }
    for (const p of this.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += dt * 130; }
    this.particles = this.particles.filter(p => p.life > 0);
    const bounds = REGIONS[this.scene];
    const halfW = Math.min(bounds.width / 2, this.width / this.zoom / 2), halfH = Math.min(bounds.height / 2, this.height / this.zoom / 2);
    const targetX = clamp(this.player.x, halfW, bounds.width - halfW);
    const targetY = clamp(this.player.y + 20, halfH, bounds.height - halfH);
    this.camera.x = lerp(this.camera.x, targetX, 1 - Math.exp(-dt * 7));
    this.camera.y = lerp(this.camera.y, targetY, 1 - Math.exp(-dt * 7));
  }

  visible(x, y, margin = 100) {
    return Math.abs(x - this.camera.x) < this.width / this.zoom / 2 + margin && Math.abs(y - this.camera.y) < this.height / this.zoom / 2 + margin;
  }

  makeCache(bounds) {
    const canvas = document.createElement('canvas'); canvas.width = bounds.width; canvas.height = bounds.height;
    return canvas;
  }

  buildNest() {
    const canvas = this.makeCache(NEST), ctx = canvas.getContext('2d'), random = seededRandom(832);
    const soil = ctx.createLinearGradient(0, 0, 0, NEST.height);
    soil.addColorStop(0, '#4a4433'); soil.addColorStop(.2, '#44392d'); soil.addColorStop(1, '#282a26');
    ctx.fillStyle = soil; ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Fine earth texture and undisturbed strata remain outside the chambers.
    for (let i = 0; i < 5600; i++) {
      const x = random() * canvas.width, y = random() * canvas.height;
      ellipse(ctx, x, y, random() * 3 + .7, random() * 1.5 + .4, i % 2 ? '#ab947419' : '#100f111b', random());
    }
    for (let i = 0; i < 12; i++) {
      const y = i * 154 + 85;
      ctx.beginPath(); ctx.moveTo(0, y);
      for (let x = 0; x <= canvas.width; x += 70) ctx.lineTo(x, y + Math.sin(x / 170 + i) * 22);
      ctx.strokeStyle = '#c3a8830b'; ctx.lineWidth = 3; ctx.stroke();
    }
    for (let i = 0; i < 22; i++) {
      const x = random() * canvas.width;
      line(ctx, [[x, 30], [x + 20, 95], [x - 12, 140 + random() * 50], [x + 40, 205 + random() * 70]], '#837c513d', 3);
    }
    const openEdges = this.graph.edges.filter(edge => !edge.locked || this.graph.open);
    const strokeNetwork = (color, width, yOffset = 0) => {
      for (const edge of openEdges) {
        const a = this.graph.nodes[edge.a], b = this.graph.nodes[edge.b];
        line(ctx, [[a.x, a.y + yOffset], [b.x, b.y + yOffset]], color, width);
      }
      for (const room of this.graph.rooms) ellipse(ctx, room.x, room.y + yOffset, room.rx + (width - 90) / 2, room.ry + (width - 90) / 2, color);
    };
    strokeNetwork('#191e1c66', 116, 9);
    strokeNetwork('#69553b', 104);
    strokeNetwork('#b39361', 91);
    strokeNetwork('#c4a474', 78, -3);
    // The chimney meets the chamber ceiling, leaving its carved label visible.
    line(ctx, [[1218, 235], [1218, 115], [1245, 80]], '#786442', 63);
    line(ctx, [[1218, 235], [1218, 115], [1245, 80]], '#cbb17a', 47);
    for (const room of this.graph.rooms) {
      const glow = ctx.createRadialGradient(room.x - 20, room.y - 30, 10, room.x, room.y, room.rx);
      glow.addColorStop(0, '#edd8a0'); glow.addColorStop(.6, '#d1b27c'); glow.addColorStop(1, '#b69765');
      ellipse(ctx, room.x, room.y - 3, room.rx - 9, room.ry - 8, glow);
      ctx.save(); ctx.beginPath(); ctx.ellipse(room.x, room.y, room.rx - 12, room.ry - 12, 0, 0, TAU); ctx.clip();
      for (let i = 0; i < 50; i++) ellipse(ctx, room.x + (random() - .5) * room.rx * 2, room.y + (random() - .5) * room.ry * 2, 1.5, .6, '#755f3730');
      this.drawRoomDecor(ctx, room, random);
      ctx.restore();
      // Hand-carved room label above a lantern-lit workspace.
      const textY = room.y - room.ry + 36;
      const width = room.name.length * 13 + 24;
      ctx.fillStyle = '#584c36db'; ctx.beginPath(); ctx.roundRect(room.x - width / 2, textY - 14, width, 27, 7); ctx.fill();
      label(ctx, room.name, room.x, textY, '#f5e4b9', 12);
      const lampX = room.x + room.rx - 43, lampY = room.y - 36;
      line(ctx, [[lampX, lampY - 27], [lampX, lampY - 11]], '#735a3c', 2);
      const lamp = ctx.createRadialGradient(lampX, lampY, 0, lampX, lampY, 46);
      lamp.addColorStop(0, '#f9d46b60'); lamp.addColorStop(1, '#f9d46b00');
      ellipse(ctx, lampX, lampY, 46, 46, lamp); ellipse(ctx, lampX, lampY, 6, 8, '#f7d984');
    }
    // Surface: roots, a green seam and the small entrance chimney.
    ctx.fillStyle = '#5a6441'; ctx.fillRect(0, 0, NEST.width, 45);
    for (let i = 0; i < 200; i++) {
      const x = random() * NEST.width;
      line(ctx, [[x, 45], [x + random() * 15 - 7, 12 + random() * 18]], i % 3 ? '#8b9558' : '#b3b974', 2 + random() * 3);
    }
    for (const edge of this.graph.edges.filter(edge => edge.locked && !this.graph.open)) {
      const a = this.graph.nodes[edge.a], b = this.graph.nodes[edge.b];
      ctx.setLineDash([5, 10]); line(ctx, [[a.x, a.y], [b.x, b.y]], '#d4b87c66', 3); ctx.setLineDash([]);
    }
    this.nestCache = canvas;
  }

  drawRoomDecor(ctx, room, random) {
    const { x, y, decor } = room;
    const floor = y + 47;
    if (decor === 'prison') {
      leaf(ctx, x - 100, floor, 50, '#777c58', 0);
      for (let i = 0; i < 8; i++) line(ctx, [[x - 170 + i * 48, y - 130], [x - 170 + i * 48, y - 78]], '#444b43', 7);
      line(ctx, [[x - 185, y - 86], [x + 180, y - 86]], '#8a8b77', 6);
    } else if (decor === 'water') {
      line(ctx, [[x - 115, y + 25], [x - 25, y + 10], [x + 90, y + 36]], '#4b6663', 35);
      line(ctx, [[x - 115, y + 25], [x - 25, y + 10], [x + 90, y + 36]], '#91b4a7', 18);
    } else if (decor === 'crack') {
      line(ctx, [[x - 45, y - 60], [x - 20, y - 35], [x - 31, y - 15], [x + 2, y + 12]], '#34423c', 7);
      for (let i = 0; i < 5; i++) ellipse(ctx, x - 50 + i * 22, y + 35, 13, 7, '#7f826c');
    } else if (decor === 'gate' || decor === 'lift') {
      line(ctx, [[x - 52, y + 35], [x - 52, y - 55], [x + 52, y - 55], [x + 52, y + 35]], '#686348', 12);
      for (let i = 0; i < 4; i++) line(ctx, [[x - 40 + i * 27, y - 40], [x - 40 + i * 27, y + 35]], '#b6a879', 5);
    } else if (['pantry', 'market'].includes(decor)) {
      for (let row = 0; row < 2; row++) for (let i = 0; i < 5; i++) {
        const px = x - 105 + i * 44, py = floor - row * 29;
        ellipse(ctx, px, py, 19, 9, '#836a4266');
        for (let j = 0; j < 5; j++) ellipse(ctx, px + (random() - .5) * 27, py - 4 - random() * 10, 7, 4, ['#d1ad63', '#ecd398', '#b88553'][j % 3], -.5);
      }
      if (decor === 'market') { line(ctx, [[x - 120, y + 20], [x - 120, y - 26], [x + 115, y - 26], [x + 115, y + 20]], '#806441', 4); leaf(ctx, x, y - 29, 98, '#9a9c60', 0); }
    } else if (decor === 'nursery') {
      for (let i = 0; i < 7; i++) {
        const px = x - 95 + i * 29, py = floor - (i % 2) * 24;
        leaf(ctx, px, py + 4, 22, '#9caa68', .15);
        ellipse(ctx, px, py - 4, 9, 14, '#fff0ce', .2); ellipse(ctx, px - 2, py - 8, 3, 6, '#ffffff66');
      }
    } else if (decor === 'rest' || decor === 'clinic') {
      for (let i = 0; i < 3; i++) { leaf(ctx, x - 75 + i * 75, floor - i % 2 * 20, 41, '#859958', -.1); ellipse(ctx, x - 95 + i * 75, floor - i % 2 * 20 - 10, 14, 7, '#d6ca92'); }
      if (decor === 'clinic') { ctx.fillStyle = '#9b7354'; ctx.fillRect(x - 100, y - 31, 65, 20); for (let i = 0; i < 4; i++) leaf(ctx, x - 90 + i * 13, y - 41, 14, '#5a8756', -.7); }
    } else if (decor === 'fungus') {
      ellipse(ctx, x, floor, 145, 29, '#77805766');
      for (let i = 0; i < 9; i++) mushroom(ctx, x - 115 + i * 29, floor + i % 3 * 4, .6 + i % 3 * .2, i % 2 ? '#bbb991' : '#969f8b');
    } else if (decor === 'garden') {
      for (let i = 0; i < 8; i++) {
        const px = x - 125 + i * 36;
        line(ctx, [[px, floor], [px + 2, y - 19 - i % 3 * 10]], '#727a4f', 3);
        leaf(ctx, px - 8, y + 9 - i % 3 * 4, 21, '#8b9b65', -.65);
        leaf(ctx, px + 10, y - 5 - i % 3 * 9, 17, '#a5b378', .65);
      }
    } else if (decor === 'royal') {
      ellipse(ctx, x + 20, floor, 127, 29, '#ae9564');
      ellipse(ctx, x + 75, y + 15, 60, 37, '#858e54');
      for (let i = 0; i < 5; i++) leaf(ctx, x + 75 + (i - 2) * 16, y - 5, 38, '#a9af6a', -1.1 + i * .5);
      ellipse(ctx, x + 75, y + 24, 58, 14, '#cdc58c');
      for (const side of [-1, 1]) { line(ctx, [[x + side * 150, y + 24], [x + side * 150, y - 45]], '#b49957', 4); ellipse(ctx, x + side * 150, y - 48, 10, 14, '#ead889'); }
      const decorations = Math.min(12, Number(this.state?.queen?.decor) || 0);
      if (decorations) {
        line(ctx, [[x - 130, y - 62], [x, y - 45], [x + 130, y - 62]], '#6e8352', 2);
        for (let i = 0; i < decorations; i++) {
          const dx = x - 120 + i * 22;
          leaf(ctx, dx, y - 52 + Math.sin(i * .65) * 8, 12, i % 2 ? '#9db972' : '#c8ce86', .6);
        }
      }
    } else if (decor === 'library') {
      for (let j = 0; j < 2; j++) { line(ctx, [[x - 122, y - 20 + j * 29], [x + 124, y - 20 + j * 29]], '#957449', 5); for (let i = 0; i < 9; i++) { ctx.fillStyle = ['#82916a', '#b68b54', '#cfb580'][i % 3]; ctx.fillRect(x - 110 + i * 27, y - 42 + j * 29, 17, 20); } }
    } else if (decor === 'workshop' || decor === 'dig') {
      for (let i = 0; i < 5; i++) ellipse(ctx, x - 100 + i * 45, floor - i % 2 * 6, 20 + i % 2 * 5, 13, '#a58353');
      line(ctx, [[x - 70, y + 5], [x - 43, y - 30]], '#6b603c', 5); line(ctx, [[x - 52, y - 30], [x - 30, y - 16]], '#b6bd90', 8);
      if (decor === 'dig') { line(ctx, [[x + 102, y - 5], [x + 102, y + 48]], '#695038', 5); line(ctx, [[x + 74, y + 12], [x + 126, y + 12]], '#c4a05d', 12); label(ctx, '공사 중', x + 98, y + 12, '#665234', 9); }
    } else if (decor === 'scout') {
      line(ctx, [[x + 5, floor], [x + 5, y - 14], [x + 45, y - 38]], '#8c704b', 6);
      line(ctx, [[x + 12, y - 14], [x + 55, y - 42]], '#a8ad83', 13);
      for (let i = 0; i < 4; i++) ellipse(ctx, x - 75 + i * 18, floor, 7, 5, '#c0ae7a');
    } else if (decor === 'guard') {
      for (let i = 0; i < 3; i++) { leaf(ctx, x - 105 + i * 40, y - 10, 28, '#879768', 1.1); line(ctx, [[x - 92 + i * 40, y + 28], [x - 70 + i * 40, y - 30]], '#816343', 3); }
    } else if (decor === 'meeting') {
      ellipse(ctx, x, floor, 99, 27, '#b0996377'); ellipse(ctx, x + 65, y - 9, 42, 18, '#99784d');
      leaf(ctx, x + 65, y - 13, 38, '#acb077', .1);
      for (let i = 0; i < 4; i++) ellipse(ctx, x + 65 + Math.cos(i * 1.5) * 64, y - 5 + Math.sin(i * 1.5) * 29, 12, 8, '#a38b61');
    } else if (decor === 'entrance') {
      line(ctx, [[x - 108, y + 25], [x - 108, y - 21]], '#86673f', 4); line(ctx, [[x - 134, y - 12], [x - 78, y - 12]], '#9da56a', 17);
      label(ctx, '어서 와요', x - 106, y - 12, '#f4eac3', 9);
      for (let i = 0; i < 4; i++) ellipse(ctx, x - 30 + i * 18, floor, 7, 4, '#ae9464');
    }
  }

  buildGarden() {
    const canvas = this.makeCache(GARDEN), ctx = canvas.getContext('2d'), random = seededRandom(921);
    ctx.fillStyle = '#7c8b5d'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < 850; i++) {
      const x = random() * canvas.width, y = random() * canvas.height;
      ellipse(ctx, x, y, 22 + random() * 74, 16 + random() * 48, ['#9fa57535', '#5a74483b', '#bfd09317', '#4c654a24'][i % 4], random() * TAU);
    }
    const trails = GARDEN_TRAILS;
    for (const points of trails) { line(ctx, points, '#718157', 168); line(ctx, points, '#b2ad78', 130); line(ctx, points, '#c2b685', 104); }
    for (let i = 0; i < 2600; i++) {
      const x = random() * canvas.width, y = random() * canvas.height;
      ellipse(ctx, x, y, .6 + random() * 2, .7 + random(), i % 2 ? '#e9deb540' : '#47593932');
    }
    // The pond is a visual landmark; its shallow rim is walkable.
    ellipse(ctx, 390, 910, 191, 152, '#687548', -.4);
    ellipse(ctx, 390, 910, 174, 132, '#a4b79a', -.4);
    ellipse(ctx, 390, 910, 154, 114, '#759e97', -.4);
    ellipse(ctx, 375, 902, 133, 97, '#87aea3', -.4);
    for (let i = 0; i < 8; i++) {
      const x = 310 + random() * 145, y = 830 + random() * 170;
      ellipse(ctx, x, y, 26, 15, '#9caf76', -.3); line(ctx, [[x, y], [x + 20, y + 6]], '#7e9867', 2);
    }
    for (let i = 0; i < 95; i++) {
      const x = random() * GARDEN.width, y = random() * GARDEN.height;
      if (distance({ x, y }, { x: 1210, y: 1390 }) < 220) continue;
      const size = 24 + random() * 55;
      for (let j = 0; j < 4; j++) leaf(ctx, x + (j - 2) * 10, y + j * 5, size, ['#687f4b', '#91a36b', '#566e46', '#a0ac6d'][j], j * 1.7 + random());
      if (i % 5 === 0) for (let j = 0; j < 5; j++) ellipse(ctx, x + Math.cos(j * TAU / 5) * 9, y - size + Math.sin(j * TAU / 5) * 9, 7, 10, i % 2 ? '#e0c6a7' : '#c1a3ac', j * TAU / 5);
    }
    // Oversized fallen log and pebble clusters establish the ant's scale.
    ctx.save(); ctx.translate(1740, 320); ctx.rotate(.25);
    line(ctx, [[-230, 0], [210, 0]], '#5f614257', 130); line(ctx, [[-230, -10], [210, -10]], '#7d6344', 106);
    for (let i = 0; i < 7; i++) line(ctx, [[-235, -47 + i * 12], [-100, -40 + i * 11], [130, -48 + i * 13], [215, -43 + i * 12]], i % 2 ? '#947b52' : '#624c35', 3);
    ellipse(ctx, 217, -10, 24, 51, '#b2915f'); ellipse(ctx, 219, -10, 16, 36, '#a18455'); ellipse(ctx, 221, -10, 8, 20, '#bda471'); ctx.restore();
    for (let i = 0; i < 32; i++) {
      const x = random() * GARDEN.width, y = random() * GARDEN.height;
      if (distance({ x, y }, { x: 1210, y: 1390 }) < 170) continue;
      ellipse(ctx, x + 6, y + 8, 22 + i % 4 * 8, 13 + i % 4 * 5, '#3e523940', -.3);
      ellipse(ctx, x, y, 22 + i % 4 * 8, 13 + i % 4 * 5, ['#a09e83', '#8e937d', '#bec0a0'][i % 3], -.3);
      ellipse(ctx, x - 5, y - 6, 11 + i % 3 * 4, 4, '#e3dfbd30', -.3);
    }
    const hx = 1210, hy = 1390;
    ellipse(ctx, hx, hy + 11, 135, 94, '#55654644');
    ellipse(ctx, hx, hy - 5, 121, 91, '#b0a377');
    ellipse(ctx, hx - 4, hy - 16, 103, 72, '#cab387');
    ellipse(ctx, hx, hy - 13, 61, 45, '#776346');
    ellipse(ctx, hx, hy - 10, 43, 32, '#343b2a');
    for (let i = 0; i < 25; i++) { const a = random() * TAU; ellipse(ctx, hx + Math.cos(a) * (75 + random() * 32), hy + Math.sin(a) * 52 - 15, 4 + random() * 5, 3, '#9a825755', a); }
    leaf(ctx, hx - 91, hy - 39, 63, '#92a35f', -.6); leaf(ctx, hx + 69, hy - 73, 51, '#819358', .4);
    label(ctx, '우리 개미굴', hx, hy + 109, '#394f33', 19);
    // A distinct outdoor lookout is both a quest location and an easy landmark.
    const scout = this.outsideEntities.find(entity => entity.id === 'scout');
    ellipse(ctx, scout.x, scout.y + 9, 67, 41, '#61784e55');
    ellipse(ctx, scout.x, scout.y, 61, 35, '#d2bd89');
    ellipse(ctx, scout.x - 6, scout.y - 7, 44, 25, '#e1cfa0');
    line(ctx, [[scout.x + 30, scout.y + 3], [scout.x + 30, scout.y - 84]], '#776540', 5);
    leaf(ctx, scout.x + 48, scout.y - 74, 28, '#b9c584', -.05);
    line(ctx, [[scout.x - 24, scout.y + 9], [scout.x - 18, scout.y - 19], [scout.x + 13, scout.y - 31]], '#8c784c', 5);
    line(ctx, [[scout.x - 12, scout.y - 22], [scout.x + 20, scout.y - 36]], '#758b68', 13);
    label(ctx, '정원 관측대', scout.x, scout.y + 58, '#354b32', 15);
    this.gardenCache = canvas;
  }

  drawResource(ctx, resource) {
    const { x, y, kind } = resource;
    const bob = Math.sin(this.time * 1.6 + resource.phase) * 2;
    ellipse(ctx, x + 3, y + 9, 18, 7, '#3c4b3330');
    if (kind === 'leaf') { leaf(ctx, x, y + bob, 28, '#bdc77b', -.5); leaf(ctx, x - 4, y + 5 + bob, 18, '#9daf62', .6); }
    else if (kind === 'dew') {
      leaf(ctx, x, y + 7, 24, '#698c59', -.2);
      ellipse(ctx, x, y - 4 + bob, 13, 15, '#a7d7d0'); ellipse(ctx, x - 4, y - 9 + bob, 4, 5, '#f0fcdf');
    } else if (kind === 'berry') {
      ellipse(ctx, x, y + bob, 19, 18, '#8b585a'); ellipse(ctx, x - 5, y - 5 + bob, 10, 9, '#af7c77');
      leaf(ctx, x + 3, y - 17 + bob, 12, '#738c50', -.5); ellipse(ctx, x - 7, y - 7 + bob, 3, 4, '#dcb8a0aa');
    } else if (kind === 'crumb') {
      ctx.save(); ctx.translate(x, y + bob); ctx.rotate(resource.phase);
      ctx.beginPath(); ctx.moveTo(-21, -12); ctx.lineTo(3, -21); ctx.lineTo(23, -7); ctx.lineTo(17, 16); ctx.lineTo(-11, 18); ctx.closePath(); ctx.fillStyle = '#d0a66b'; ctx.fill();
      for (let i = 0; i < 5; i++) ellipse(ctx, -10 + i % 3 * 9, -9 + Math.floor(i / 3) * 15, 3, 2, '#ad8152'); ctx.restore();
    } else {
      ellipse(ctx, x, y + bob, 19, 10, '#b18a4c', -.5); ellipse(ctx, x - 2, y - 3 + bob, 15, 7, '#dec285', -.5);
      line(ctx, [[x - 12, y + 3 + bob], [x + 11, y - 8 + bob]], '#b7945966', 1.5);
    }
    if (Math.sin(this.time * 1.7 + resource.phase * 5) > .85) {
      const sx = x + 20, sy = y - 22;
      line(ctx, [[sx - 3, sy], [sx + 3, sy]], '#f4e8bccc', 1.5); line(ctx, [[sx, sy - 4], [sx, sy + 4]], '#f4e8bccc', 1.5);
    }
  }

  drawNavigation(ctx) {
    if (!this.homeTrail || this.scene !== 'outside') return;
    for (let i = 1; i < this.homePath.length; i++) {
      const a = this.homePath[i - 1], b = this.homePath[i], length = distance(a, b);
      for (let d = 0; d < length; d += 22) {
        const x = lerp(a.x, b.x, d / length), y = lerp(a.y, b.y, d / length);
        if (!this.visible(x, y, 10)) continue;
        const alpha = .35 + Math.sin(this.time * 2 - d * .02 - i) * .15;
        ellipse(ctx, x, y, 8, 6, `rgba(211,235,152,${alpha * .35})`);
        ellipse(ctx, x, y, 2.8, 2.8, `rgba(237,250,182,${alpha + .3})`);
      }
    }
  }

  drawEvent(ctx) {
    if (!this.event) return;
    const kind = typeof this.event === 'string' ? this.event : `${this.event.kind || ''} ${this.event.type || ''} ${this.event.id || ''}`;
    if (this.scene === 'outside' && /rain|flood|storm|repair|비|홍수|폭우/.test(kind || '')) {
      const left = this.camera.x - this.width / this.zoom / 2, top = this.camera.y - this.height / this.zoom / 2;
      ctx.fillStyle = '#49707322'; ctx.fillRect(left - 20, top - 20, this.width / this.zoom + 40, this.height / this.zoom + 40);
      for (let i = 0; i < 80; i++) {
        const x = left + ((i * 113 + this.time * 60) % (this.width / this.zoom));
        const y = top + ((i * 67 + this.time * 370) % (this.height / this.zoom));
        line(ctx, [[x, y], [x - 5, y + 18]], '#c4e0cf66', 1.4);
      }
    }
    if (this.predator?.scene === this.scene && /predator|beetle|spider|defend|포식|거미|딱정/.test(kind || '')) {
      const recoil = this.predatorRecoil || 0;
      const x = this.predator.x + Math.sin(this.time * 16) * recoil * 15, y = this.predator.y - recoil * 8;
      ctx.save(); ctx.translate(x, y);
      ellipse(ctx, 0, 23, 61, 18, '#33452a44');
      for (let i = -1; i <= 1; i++) for (const side of [-1, 1]) line(ctx, [[i * 19, 0], [i * 25, side * 35], [i * 34 + 12, side * 52 + Math.sin(this.time * 6 + i) * 5]], '#485341', 5);
      ellipse(ctx, -19, 0, 44, 35, '#65724e'); ellipse(ctx, -27, -7, 27, 17, '#829066'); line(ctx, [[-57, 0], [12, 0]], '#536044', 2);
      ellipse(ctx, 28, 0, 22, 26, '#727e52'); ellipse(ctx, 39, -12, 5, 6, '#e6deb1'); ellipse(ctx, 39, 12, 5, 6, '#e6deb1');
      ellipse(ctx, 41, -12, 2, 4, '#293f2c'); ellipse(ctx, 41, 12, 2, 4, '#293f2c'); ctx.restore();
      label(ctx, '풀숲의 방문자', x, y - 72, '#f4e8bb', 13);
      const remaining = 1 - clamp((Number(this.event.progress) || 0) / (Number(this.event.count) || 6), 0, 1);
      ctx.fillStyle = '#40543ee0'; ctx.beginPath(); ctx.roundRect(x - 54, y - 94, 108, 9, 5); ctx.fill();
      if (remaining > 0) { ctx.fillStyle = '#ead18f'; ctx.beginPath(); ctx.roundRect(x - 52, y - 92, 104 * remaining, 5, 3); ctx.fill(); }
    }
  }

  buildRegion(scene) {
    const region = REGIONS[scene], graph = this.regionGraphs[scene], canvas = this.makeCache(region), ctx = canvas.getContext('2d'), random = seededRandom(scene.length * 761);
    const [soil, wall, floor] = region.palette;
    ctx.fillStyle = soil; ctx.fillRect(0, 0, region.width, region.height);
    for (let i = 0; i < 1000; i++) ellipse(ctx, random() * region.width, random() * region.height, 2 + random() * 3, 1.5, '#d9ca9720');
    for (const [color, width] of [[wall, 101], [floor, 79]]) {
      for (const edge of graph.edges) { if (scene === 'prison' && !this.passageOpen) continue; const a = graph.nodes[edge.a], b = graph.nodes[edge.b]; line(ctx, [[a.x, a.y], [b.x, b.y]], color, width); }
      for (const room of graph.rooms) { if (scene === 'prison' && !this.passageOpen && room.id === 'crack') continue; ellipse(ctx, room.x, room.y, room.rx + (width - 90) / 2, room.ry + (width - 90) / 2, color); }
    }
    for (const room of graph.rooms) {
      if (scene === 'prison' && !this.passageOpen && room.id === 'crack') continue;
      ctx.save(); ctx.beginPath(); ctx.ellipse(room.x, room.y, room.rx - 12, room.ry - 12, 0, 0, TAU); ctx.clip();
      this.drawRoomDecor(ctx, room, random); ctx.restore();
      const w = room.name.length * 12 + 22;
      ctx.fillStyle = '#283a32dd'; ctx.beginPath(); ctx.roundRect(room.x - w / 2, room.y - room.ry + 14, w, 28, 7); ctx.fill();
      label(ctx, room.name, room.x, room.y - room.ry + 28, '#f6e9bd', 12);
    }
    // Keep only two offscreen regional canvases; the garden and nest have their own caches.
    if (this.regionCaches.size >= 2) this.regionCaches.delete(this.regionCaches.keys().next().value);
    this.regionCaches.set(scene, canvas);
  }

  drawRegionEntities(ctx) {
    const entities = [...(this.regionEntities[this.scene] || []), ...(this.scene === 'nest' ? this.nestEntities.filter(entity => entity.type === 'story') : [])];
    for (const entity of entities) {
      if (this.scene === 'prison' && entity.type === 'portal' && !this.passageOpen) continue;
      if (!this.visible(entity.x, entity.y)) continue;
      const { x, y, appearance } = entity;
      if (appearance === 'door') {
        ellipse(ctx, x, y, 42, 33, '#293b33'); ellipse(ctx, x, y - 3, 30, 23, '#182a24');
        line(ctx, [[x - 40, y + 15], [x - 35, y - 33], [x + 35, y - 33], [x + 40, y + 15]], '#c5b483', 8);
      } else if (appearance === 'mushroom') mushroom(ctx, x, y, 1.2, '#8bbfb1');
      else if (appearance === 'crack') line(ctx, [[x - 8, y - 22], [x + 6, y - 8], [x - 5, y + 7], [x + 9, y + 20]], '#243732', 6);
      else if (appearance === 'record') { leaf(ctx, x, y, 29, '#d5cc91', 0); for (let i = 0; i < 3; i++) line(ctx, [[x - 10, y - 9 + i * 7], [x + 12, y - 9 + i * 7]], '#6a7652', 2); }
      else if (appearance === 'flag') { line(ctx, [[x, y + 15], [x, y - 60]], '#645239', 6); leaf(ctx, x + 22, y - 48, 28, this.state?.campaign?.원정 ? '#96b773' : '#ba8760', 0); }
      else if (appearance === 'shop') { leaf(ctx, x, y - 20, 45, '#8fa66b', 0); label(ctx, '씨앗 교환', x, y + 3, '#2d4233', 12); }
      else if (!['ant', 'queen'].includes(appearance)) {
        ellipse(ctx, x, y + 8, 24, 12, '#4c604c'); label(ctx, appearance === 'water' ? '≈' : '◇', x, y, '#e2d9aa', 25);
      }
      label(ctx, entity.name, x, y - (appearance === 'queen' ? 82 : 52), '#fff0cd', 13);
    }
    if (this.scene === 'nest') {
      for (const room of NEST_ROOMS) if (ROOM_RANKS[room.id] && ROOM_RANKS[room.id] > this.player.rank && this.visible(room.x, room.y)) {
        ctx.beginPath(); ctx.ellipse(room.x, room.y, room.rx + 4, room.ry + 4, 0, 0, TAU); ctx.strokeStyle = '#ca8c617d'; ctx.lineWidth = 6; ctx.stroke();
        const text = `${RANK_LABELS[ROOM_RANKS[room.id]]}부터 출입`;
        ctx.fillStyle = '#713e31ec'; ctx.beginPath(); ctx.roundRect(room.x - 92, room.y - 25, 184, 32, 8); ctx.fill();
        label(ctx, text, room.x, room.y - 9, '#fff0d7', 13);
      }
      const front = this.nestEntities.find(entity => entity.id === 'dig');
      if (!this.graph.open && this.visible(front.x, front.y)) {
        ellipse(ctx, front.x + 23, front.y + 8, 28, 32, '#826649');
        label(ctx, this.dug === DIG_LIMIT - 1 ? '마지막 흙벽 · 직접 개통' : `굴착 ${this.dug} / ${DIG_LIMIT}`, front.x, front.y - 44, '#fff0cf', 13);
        // The construction crew works at the moving face, not in the old room.
        for (let i = 0; i < 3; i++) drawAnt(ctx, { x: front.x - 27 - i * 15, y: front.y + 11 + i * 7, size: .62, hat: 'helmet', facing: 1, moving: true, phase: i }, this.time);
      }
    }
  }

  drawExcavation(ctx) {
    if(this.scene!=='nest'||this.graph.open)return;
    const manual=this.activity?.kind==='dig',progress=manual?this.activity.progress||0:this.dug<7?this.ambientWork/160:0;
    if(progress<=0)return;
    const path=this.digPath(Math.min(1,(this.dug+progress)/DIG_LIMIT)).map(p=>[p.x,p.y]);
    line(ctx,path,'#69553b',91);line(ctx,path,'#b39361',78);line(ctx,path,'#c4a474',63);
    const [x,y]=path.at(-1);
    for(let i=0;i<5;i++)ellipse(ctx,x+Math.sin(this.time*10+i)*14,y+Math.cos(this.time*7+i)*12,3,2,'#9e7549');
  }

  render() {
    const ctx = this.ctx;
    if (!ctx || !this.width || !this.height) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = this.scene === 'nest' ? '#303129' : '#7c8b5d'; ctx.fillRect(0, 0, this.width, this.height);
    ctx.save(); ctx.translate(this.width / 2, this.height * .52); ctx.scale(this.zoom, this.zoom); ctx.translate(-this.camera.x, -this.camera.y);
    if (this.scene === 'nest') { if (!this.nestCache) this.buildNest(); ctx.drawImage(this.nestCache, 0, 0); }
    else if (this.scene === 'outside') { if (!this.gardenCache) this.buildGarden(); ctx.drawImage(this.gardenCache, 0, 0); }
    else { if (!this.regionCaches.has(this.scene)) this.buildRegion(this.scene); ctx.drawImage(this.regionCaches.get(this.scene), 0, 0); }
    this.drawExcavation(ctx);
    if (this.scene === 'outside') {
      const phase = Math.floor((this.state?.stats?.playSeconds || 0) / 240) % 4;
      ctx.fillStyle = ['#ffe9b00d', '#f7e7ad00', '#e6936038', '#1f304f79'][phase]; ctx.fillRect(0, 0, GARDEN.width, GARDEN.height);
    }
    this.drawNavigation(ctx);
    if (this.scene === 'outside') for (const resource of this.resources) if (resource.available && this.visible(resource.x, resource.y)) this.drawResource(ctx, resource);
    const storyAnts = (this.regionEntities[this.scene] || []).filter(entity => entity.appearance === 'ant' || entity.appearance === 'queen').map((entity, i) => ({ ...entity, size: entity.appearance === 'queen' ? 1.8 : 1, crown: entity.appearance === 'queen', hat: ['helmet', 'leaf', 'flower'][i % 3], moving: entity.id === '은빛전투', facing: -1, phase: i }));
    const allies = ['throne', 'frontier'].includes(this.scene) ? (this.state?.campaign?.동맹 || []).map((name, i) => ({ name, x: this.player.x - 45 - i * 30 + Math.sin(this.time * 4 + i) * 7, y: this.player.y + 35 + i * 6, facing: 1, size: .9, moving: true, hat: ['helmet', 'flower', 'leaf'][i], rank: 2, phase: i })) : [];
    const locals = this.scene === 'nest' ? [...this.workers, ...this.npcs] : this.scene === 'outside' ? this.gardenWorkers : [...storyAnts,...(this.regionWorkers[this.scene]||[])];
    this.player.emote = this.emoteUntil > this.time ? this.emoteName : null;
    const actors = [...locals, ...this.guardAnts.filter(ant => ant.scene === this.scene), ...allies, ...this.followers, this.player];
    actors.sort((a, b) => a.y - b.y);
    for (const actor of actors) if (this.visible(actor.x, actor.y)) drawAnt(ctx, actor, this.time, this.scene === 'outside', actor === this.player);
    this.drawRegionEntities(ctx);
    if (this.bossTelegraph) {
      const warning = this.bossTelegraph;
      ellipse(ctx, warning.x, warning.y, warning.radius, warning.radius, '#b6484155');
      ctx.beginPath(); ctx.arc(warning.x, warning.y, warning.radius, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = '#ffb47b'; ctx.stroke();
      label(ctx, '피하세요!', warning.x, warning.y - warning.radius - 15, '#fff0ce', 16);
    }
    if (this.emoteUntil > this.time) {
      const messages = { 인사: '반가워요!', 위엄: '군락을 위하여!', 기쁨: '함께 해냈어요!', 격려: '너희를 믿어!' };
      const y = this.player.y - 76 - Math.sin(this.time * 7) * 4;
      ellipse(ctx, this.player.x, y, 83, 22, '#f3e7c9ef'); label(ctx, messages[this.emoteName] || this.emoteName, this.player.x, y, '#3a523c', 13);
    }
    if (this.scene === 'nest') {
      for (const npc of this.npcs) if (this.visible(npc.x, npc.y)) {
        const active = distance(this.player, npc) < 150;
        const textY = npc.y - 48 * npc.size;
        ctx.fillStyle = active ? '#364035ed' : '#4d493add'; ctx.beginPath();
        ctx.roundRect(npc.x - (npc.name.length * 6.5 + 12), textY - 11, npc.name.length * 13 + 24, 23, 8); ctx.fill();
        label(ctx, npc.name, npc.x, textY, active ? '#f5e5ad' : '#efe0b6', 12);
        if (active) label(ctx, npc.role, npc.x, textY - 21, '#f0dba9', 10);
      }
      for (const entity of this.nestEntities) if (entity.type !== 'npc' && this.visible(entity.x, entity.y)) {
        const active = distance(this.player, entity) < 130;
        if (active || entity.type === 'exit') {
          const symbols = { nursery: '♡', rest: '☾', guard: '◇', scout: '⌖', royal: '♛', dig: '⚒', exit: '↗' };
          ellipse(ctx, entity.x, entity.y - 44, 13, 13, '#566341e8');
          label(ctx, symbols[entity.kind || entity.id] || '·', entity.x, entity.y - 44, '#f4e3b2', 17);
        }
      }
      if (this.digAnimation > 0) {
        const spot = this.nestEntities.find(entity => entity.id === 'dig');
        for (let i = 0; i < 6; i++) ellipse(ctx, spot.x + 24 + i * 6, spot.y + Math.sin(this.time * 12 + i) * 10, 5, 4, '#ab8457');
      }
    }
    const nearest = this.nearest();
    if (nearest) {
      ctx.beginPath(); ctx.ellipse(nearest.x, nearest.y + 14, nearest.type === 'resource' ? 31 : 36, this.scene === 'nest' ? 14 : 27, 0, 0, TAU);
      ctx.strokeStyle = '#fff0bdcc'; ctx.lineWidth = 2; ctx.setLineDash([4, 5]); ctx.stroke(); ctx.setLineDash([]);
    }
    this.drawEvent(ctx);
    for (const p of this.particles) { ctx.globalAlpha = Math.min(1, p.life * 2); ellipse(ctx, p.x, p.y, p.size, p.size, p.color); }
    ctx.globalAlpha = 1;
    // A few soft motes, kept deterministic and culled to the viewport.
    for (let i = 0; i < 14; i++) {
      const x = this.camera.x + Math.sin(this.time * .05 + i * 7) * this.width / this.zoom * .55;
      const y = this.camera.y + Math.cos(this.time * .08 + i * 11) * this.height / this.zoom * .55;
      ellipse(ctx, x, y, this.scene === 'nest' ? 1.5 : 2, this.scene === 'nest' ? 1.5 : 2, this.scene === 'nest' ? '#f4ddb744' : '#ffedbd77');
    }
    ctx.restore();
    const vignette = ctx.createRadialGradient(this.width / 2, this.height / 2, Math.min(this.width, this.height) * .2, this.width / 2, this.height / 2, Math.max(this.width, this.height) * .75);
    vignette.addColorStop(0, '#15221a00'); vignette.addColorStop(1, this.scene === 'nest' ? '#16221955' : '#2c432d33');
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, this.width, this.height);
  }

  drawMap(canvas) {
    const ctx = canvas.getContext('2d'), rect = canvas.getBoundingClientRect();
    const width = rect.width || 650, height = rect.height || 420, dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#2b342b'; ctx.fillRect(0, 0, width, height);
    const bounds = REGIONS[this.scene];
    const scale = Math.min((width - 36) / bounds.width, (height - 38) / bounds.height);
    const ox = (width - bounds.width * scale) / 2, oy = (height - bounds.height * scale) / 2;
    const detailed = width >= 280 && height >= 200;
    const shortRoomNames = { entrance: '입구', nursery: '알방', meeting: '광장', pantry: '창고', scout: '관측소', rest: '쉼터', workshop: '공방', guard: '경비실', fungus: '버섯밭', clinic: '치료소', library: '도서관', market: '장터', dig: '공사장', garden: '정원', royal: '왕실' };
    const point = (x, y) => [ox + x * scale, oy + y * scale];
    if (this.scene !== 'outside') {
      const graph = this.currentGraph();
      for (const edge of graph.edges) {
        if (this.scene === 'prison' && !this.passageOpen) continue;
        if (edge.locked && !graph.open) continue;
        const a = graph.nodes[edge.a], b = graph.nodes[edge.b]; line(ctx, [point(a.x, a.y), point(b.x, b.y)], '#a19a6b', Math.max(2, 38 * scale));
      }
      for (const room of graph.rooms) {
        if (this.scene === 'prison' && !this.passageOpen && room.id === 'crack') continue;
        const locked = this.scene === 'nest' && (ROOM_RANKS[room.id] || 0) > this.player.rank;
        const [x, y] = point(room.x, room.y); ellipse(ctx, x, y, room.rx * scale, room.ry * scale, locked ? '#a17461' : '#c2b184');
        if (detailed) label(ctx, (this.scene === 'nest' ? shortRoomNames[room.id] : null) || room.name, x, y, '#263326', Math.max(8, Math.min(11, width / 50)));
      }
    } else {
      if (!this.gardenCache) this.buildGarden();
      ctx.globalAlpha = .62; ctx.drawImage(this.gardenCache, ox, oy, GARDEN.width * scale, GARDEN.height * scale); ctx.globalAlpha = 1;
      const shown = new Set();
      for (const resource of this.resources) {
        const key = resource.id.split('-').slice(0, 2).join('-');
        if (shown.has(key)) continue; shown.add(key);
        const [x, y] = point(resource.x, resource.y); ellipse(ctx, x, y, 5, 5, ({ seed: '#dfbf74', dew: '#a0d3d2', leaf: '#c6d28a', crumb: '#d6b590', berry: '#d09b9d' })[resource.kind]);
        if (detailed) label(ctx, ({ seed: '씨앗', dew: '이슬', leaf: '잎', crumb: '과자', berry: '열매' })[resource.kind], x, y + 13, '#fff0ce', 10);
      }
      const [x, y] = point(1210, 1390); ellipse(ctx, x, y, 9, 9, '#ecd48e'); label(ctx, '집', x, y - 18, '#fff3c7', 12);
      const scout = this.outsideEntities.find(entity => entity.id === 'scout');
      const [sx, sy] = point(scout.x, scout.y); ellipse(ctx, sx, sy, detailed ? 6 : 3, detailed ? 6 : 3, '#d8dea1');
      if (detailed) label(ctx, '관측대', sx, sy - 15, '#fff3c7', 10);
    }
    for (const entity of this.regionEntities[this.scene] || []) {
      if (this.scene === 'prison' && entity.type === 'portal' && !this.passageOpen) continue;
      if (entity.type !== 'portal' && !detailed) continue;
      const [x, y] = point(entity.x, entity.y); ellipse(ctx, x, y, 4, 4, entity.type === 'portal' ? '#a3d4cb' : '#e5ce91');
      if (detailed) label(ctx, entity.type === 'portal' ? entity.name : entity.id, x, y + 13, '#fff0ce', 9);
    }
    const [px, py] = point(this.player.x, this.player.y);
    ellipse(ctx, px, py, 7, 7, '#f5eee0'); ellipse(ctx, px, py, 4, 4, '#608675');
    label(ctx, '나', px, py - 15, '#fff3cd', 11);
    this.mapTransform = { scale, ox, oy, width, height };
  }

  moveToMap() { return false; }
}
