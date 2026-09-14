/* A connected, living ant colony. Distances and speeds use world pixels. */
const TAU = Math.PI * 2;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a, b, t) => a + (b - a) * t;
const COLORS = ['#b87945', '#9d603c', '#825039', '#ae6640', '#c89048', '#dfa955'];
const SIZES = [1, 1.12, 1.24, 1.35, 1.5, 1.8];
const GARDEN = { width: 2500, height: 1900 };
const NEST = { width: 2500, height: 1720 };

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

/** The same graph drives player movement, workers, navigation and the map. */
export class ColonyGraph {
  constructor() {
    this.nodes = NEST_ROOMS.map(room => ({ ...room }));
    this.edges = [];
    for (const [from, to, bends, locked] of CORRIDORS) {
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
    const room = NEST_ROOMS.find(r => ((point.x - r.x) / (r.rx - 25)) ** 2 + ((point.y - r.y) / (r.ry - 24)) ** 2 <= 1);
    if (room) return { point: { x: point.x, y: point.y }, projection: { x: room.x, y: room.y }, room: room.id };
    let best = null;
    for (const edge of this.edges) {
      if (edge.locked && !this.open) continue;
      const projection = projectSegment(point, this.nodes[edge.a], this.nodes[edge.b]);
      const d = distance(point, projection);
      if (!best || d < best.distance) best = { point: projection, projection, edge, distance: d };
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
  ctx.save(); ctx.translate(ant.x, ant.y);
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
  constructor(canvas, { npcs = [], onNotice = () => {} } = {}) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.onNotice = onNotice;
    this.graph = new ColonyGraph(); this.scene = 'nest'; this.time = 0; this.dug = 0; this.state = null;
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
    ];
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
    this.resize();
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
    const rank = clamp(Number(state?.rank) || 0, 0, 5);
    this.player.rank = rank; this.player.size = SIZES[rank]; this.player.color = COLORS[rank];
    if (this.dug < (Number(state?.world?.dug) || 0)) this.setDug(state.world.dug);
  }

  setMode(scene) {
    if (scene !== 'nest' && scene !== 'outside' || scene === this.scene) return;
    this.scene = scene; this.path = []; this.input = { x: 0, y: 0 }; this.guide = null;
    Object.assign(this.player, scene === 'nest' ? { x: 1260, y: 250 } : { x: 1210, y: 1450 });
    this.camera.x = this.player.x; this.camera.y = this.player.y + 30;
    this.followers.forEach((follower, i) => { follower.x = this.player.x - 45 * (i + 1); follower.y = this.player.y + 10; follower.path = []; });
    this.onNotice(scene === 'outside' ? '바람 냄새가 나요. 지도에서 집과 먹이를 찾아보세요.' : '우리 굴에 돌아왔어요. 가고 싶은 곳을 눌러 이동하세요.');
  }

  setInput(x, y) {
    const length = Math.hypot(x, y);
    this.input.x = length > 1 ? x / length : x; this.input.y = length > 1 ? y / length : y;
    if (length > .05) this.path = [];
  }

  screenToWorld(x, y) {
    return { x: (x - this.width / 2) / this.zoom + this.camera.x, y: (y - this.height * .52) / this.zoom + this.camera.y };
  }

  moveToScreen(x, y) {
    const point = this.screenToWorld(x, y);
    this.guide = null;
    if (this.scene === 'nest') this.path = this.graph.route(this.player, point);
    else this.path = [{ x: clamp(point.x, 65, GARDEN.width - 65), y: clamp(point.y, 70, GARDEN.height - 70) }];
    this.destination = this.path.at(-1) || null;
  }

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
    if (this.scene === 'nest') return [...this.npcs, ...this.nestEntities];
    return [...this.outsideEntities.filter(entity => entity.available !== false), ...(this.predator ? [this.predator] : [])];
  }

  guideTo(id) {
    const all = [...this.npcs.map(n => ({ ...n, scene: 'nest' })), ...this.nestEntities, ...this.outsideEntities, ...(this.predator ? [this.predator] : [])];
    const matches = all.filter(entity => (entity.id === id || entity.kind === id) && entity.available !== false);
    matches.sort((a, b) => Number(b.scene === this.scene) - Number(a.scene === this.scene) || distance(this.player, a) - distance(this.player, b));
    let target = matches[0];
    if (!target) return false;
    const otherScene = target.scene !== this.scene;
    if (otherScene) target = this.scene === 'nest' ? this.nestEntities[0] : this.outsideEntities[0];
    this.guide = { id, target, otherScene };
    if (this.scene === 'nest') this.path = this.graph.route(this.player, target);
    this.destination = target;
    return true;
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
    this.dug = Math.max(0, Number(value) || 0);
    const open = this.dug >= 5;
    if (this.graph.open !== open) { this.graph.open = open; this.nestCache = null; }
  }

  dig() {
    this.setDug(this.dug + 1); this.digAnimation = 1.3;
    const spot = this.nestEntities.find(entity => entity.id === 'dig');
    this.burst(spot.x + 40, spot.y + 10, '#b4865b', 16);
    if (this.dug === 5) this.onNotice('새 통로 완성! 버섯밭과 씨앗 장터 사이에 지름길이 열렸어요.');
    return { dug: this.dug, opened: this.dug === 5 };
  }

  setEvent(event) {
    const previousKey = this.event && (this.event.id || this.event.type || this.event);
    const nextKey = event && (event.id || event.type || event);
    const kind = typeof event === 'string' ? event : `${event?.kind || ''} ${event?.type || ''} ${event?.id || ''}`;
    if (event && /predator|beetle|spider|defend|포식|거미|딱정/.test(kind)) {
      if (!this.predator || previousKey !== nextKey) {
        const origin = this.scene === 'outside' ? this.player : { x: 1210, y: 1510 };
        this.predator = { id: 'predator', type: 'station', kind: 'guard', name: '포식자 밀어내기',
          x: clamp(origin.x + 170, 150, GARDEN.width - 150), y: clamp(origin.y - 100, 150, GARDEN.height - 150), scene: 'outside' };
        this.lastEventProgress = 0;
      }
      const progress = Number(event.progress) || 0;
      if (progress > (this.lastEventProgress || 0)) {
        this.predatorRecoil = .6; this.burst(this.predator.x, this.predator.y + 25, '#e6d094', 12);
      }
      this.lastEventProgress = progress;
    } else { this.predator = null; this.predatorRecoil = 0; }
    this.event = event;
    if (event && previousKey !== nextKey) this.eventStarted = this.time;
  }

  getSnapshot() {
    return { scene: this.scene, x: Math.round(this.player.x), y: Math.round(this.player.y), dug: this.dug, followers: this.followers.length, ambientWork: Math.round(this.ambientWork) };
  }

  applySnapshot(data) {
    if (!data || !Number.isFinite(Number(data.x)) || !Number.isFinite(Number(data.y))) return;
    this.setDug(data.dug || 0); this.ambientWork = clamp(Number(data.ambientWork) || 0, 0, 159);
    this.scene = data.scene === 'outside' ? 'outside' : 'nest';
    const x = Number(data.x), y = Number(data.y);
    const point = x === 0 && y === 0 ? { x: 1235, y: 265 } : { x, y };
    if (this.scene === 'nest') Object.assign(this.player, this.graph.snap(point).point);
    else Object.assign(this.player, { x: clamp(x, 65, GARDEN.width - 65), y: clamp(y, 70, GARDEN.height - 70) });
    this.path = []; this.followers = []; this.camera.x = this.player.x; this.camera.y = this.player.y + 30;
    this.recruit(clamp(Number(data.followers) || 0, 0, 5));
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
    dt = clamp(dt, 0, .08); this.time += dt;
    if (this.predatorRecoil > 0) this.predatorRecoil = Math.max(0, this.predatorRecoil - dt);
    if (!this.graph.open) {
      this.ambientWork += dt;
      if (this.ambientWork >= 160) {
        this.ambientWork -= 160; this.setDug(this.dug + 1);
        if (this.graph.open) this.onNotice('굴착조가 새 길을 완성했어요! 버섯밭과 장터가 가까워졌어요.');
      }
    }
    if (this.digAnimation > 0) this.digAnimation -= dt;
    const speed = 185 + this.player.rank * 10;
    const inputLength = Math.hypot(this.input.x, this.input.y);
    if (inputLength > .05) {
      if (this.scene === 'outside') {
        this.player.x = clamp(this.player.x + this.input.x * speed * dt, 65, GARDEN.width - 65);
        this.player.y = clamp(this.player.y + this.input.y * speed * dt, 70, GARDEN.height - 70);
        this.player.angle = Math.atan2(this.input.y, this.input.x); this.player.moving = true;
      } else {
        const next = { x: this.player.x + this.input.x * speed * dt, y: this.player.y + this.input.y * speed * dt };
        const projected = this.graph.snap(next).point;
        this.player.moving = distance(this.player, projected) > .2; Object.assign(this.player, projected);
      }
      if (Math.abs(this.input.x) > .1) this.player.facing = this.input.x >= 0 ? 1 : -1;
    } else this.moveAlong(this.player, this.path, speed, dt, this.scene === 'outside');
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
    } else {
      for (const [i, worker] of this.gardenWorkers.entries()) {
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
    this.followers.forEach((follower, i) => {
      const preceding = i ? this.followers[i - 1] : this.player;
      const d = distance(follower, preceding); follower.repath -= dt;
      if (d > 60 && follower.repath <= 0) {
        follower.path = this.scene === 'nest' ? this.graph.route(follower, preceding) : [{ x: preceding.x, y: preceding.y }];
        follower.repath = .45;
      }
      if (d <= 48) follower.path = [];
      this.moveAlong(follower, follower.path, speed + 17, dt, this.scene === 'outside');
    });
    for (const p of this.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += dt * 130; }
    this.particles = this.particles.filter(p => p.life > 0);
    const bounds = this.scene === 'nest' ? NEST : GARDEN;
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
      for (const room of NEST_ROOMS) ellipse(ctx, room.x, room.y + yOffset, room.rx + (width - 90) / 2, room.ry + (width - 90) / 2, color);
    };
    strokeNetwork('#191e1c66', 116, 9);
    strokeNetwork('#69553b', 104);
    strokeNetwork('#b39361', 91);
    strokeNetwork('#c4a474', 78, -3);
    // The chimney meets the chamber ceiling, leaving its carved label visible.
    line(ctx, [[1218, 235], [1218, 115], [1245, 80]], '#786442', 63);
    line(ctx, [[1218, 235], [1218, 115], [1245, 80]], '#cbb17a', 47);
    for (const room of NEST_ROOMS) {
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
    if (['pantry', 'market'].includes(decor)) {
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
    const trails = [
      [[1210, 1390], [1150, 1190], [920, 1150], [530, 1100], [440, 880], [620, 550]],
      [[1210, 1390], [1510, 1450], [1770, 1420], [1980, 1250], [2070, 900], [2090, 470]],
      [[920, 1150], [1100, 970], [1190, 740], [1150, 500]],
      [[1100, 970], [1500, 990], [1570, 760], [1700, 610], [2090, 470]],
      [[1210, 1390], [1010, 1530], [790, 1580], [510, 1570]],
    ];
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
    if (this.scene === 'nest' && this.path.length) {
      ctx.setLineDash([2, 15]); ctx.lineDashOffset = -this.time * 13;
      line(ctx, [[this.player.x, this.player.y + 14], ...this.path.map(p => [p.x, p.y + 14])], '#fdf1b899', 3); ctx.setLineDash([]);
    }
    if (!this.guide) return;
    const target = this.guide.target;
    if (this.scene === 'outside') {
      const angle = Math.atan2(target.y - this.player.y, target.x - this.player.x);
      const d = distance(this.player, target);
      for (let i = 1; i < Math.min(13, d / 30); i++) {
        const alpha = .5 * (1 - i / 15);
        ellipse(ctx, this.player.x + Math.cos(angle) * i * 30, this.player.y + Math.sin(angle) * i * 30, 3, 3, `rgba(255,241,178,${alpha})`);
      }
      const ax = this.player.x + Math.cos(angle) * 95, ay = this.player.y + Math.sin(angle) * 95;
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(angle);
      line(ctx, [[-8, -7], [0, 0], [-8, 7]], '#fff0b7', 3); ctx.restore();
    }
    if (this.visible(target.x, target.y)) {
      ctx.beginPath(); ctx.ellipse(target.x, target.y + 12, 46 + Math.sin(this.time * 3) * 3, 23, 0, 0, TAU);
      ctx.strokeStyle = '#fff0b999'; ctx.lineWidth = 2; ctx.stroke();
    }
  }

  drawEvent(ctx) {
    if (!this.event || this.scene !== 'outside') return;
    const kind = typeof this.event === 'string' ? this.event : `${this.event.kind || ''} ${this.event.type || ''} ${this.event.id || ''}`;
    if (/rain|flood|storm|repair|비|홍수|폭우/.test(kind || '')) {
      const left = this.camera.x - this.width / this.zoom / 2, top = this.camera.y - this.height / this.zoom / 2;
      ctx.fillStyle = '#49707322'; ctx.fillRect(left - 20, top - 20, this.width / this.zoom + 40, this.height / this.zoom + 40);
      for (let i = 0; i < 80; i++) {
        const x = left + ((i * 113 + this.time * 60) % (this.width / this.zoom));
        const y = top + ((i * 67 + this.time * 370) % (this.height / this.zoom));
        line(ctx, [[x, y], [x - 5, y + 18]], '#c4e0cf66', 1.4);
      }
    }
    if (this.predator && /predator|beetle|spider|defend|포식|거미|딱정/.test(kind || '')) {
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

  render() {
    const ctx = this.ctx;
    if (!ctx || !this.width || !this.height) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = this.scene === 'nest' ? '#303129' : '#7c8b5d'; ctx.fillRect(0, 0, this.width, this.height);
    ctx.save(); ctx.translate(this.width / 2, this.height * .52); ctx.scale(this.zoom, this.zoom); ctx.translate(-this.camera.x, -this.camera.y);
    if (this.scene === 'nest') { if (!this.nestCache) this.buildNest(); ctx.drawImage(this.nestCache, 0, 0); }
    else { if (!this.gardenCache) this.buildGarden(); ctx.drawImage(this.gardenCache, 0, 0); }
    this.drawNavigation(ctx);
    if (this.scene === 'outside') for (const resource of this.resources) if (resource.available && this.visible(resource.x, resource.y)) this.drawResource(ctx, resource);
    const actors = this.scene === 'nest' ? [...this.workers, ...this.npcs, ...this.followers, this.player] : [...this.gardenWorkers, ...this.followers, this.player];
    actors.sort((a, b) => a.y - b.y);
    for (const actor of actors) if (this.visible(actor.x, actor.y)) drawAnt(ctx, actor, this.time, this.scene === 'outside', actor === this.player);
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
    const bounds = this.scene === 'nest' ? NEST : GARDEN;
    const scale = Math.min((width - 36) / bounds.width, (height - 38) / bounds.height);
    const ox = (width - bounds.width * scale) / 2, oy = (height - bounds.height * scale) / 2;
    const detailed = width >= 280 && height >= 200;
    const shortRoomNames = { entrance: '입구', nursery: '알방', meeting: '광장', pantry: '창고', scout: '관측소', rest: '쉼터', workshop: '공방', guard: '경비실', fungus: '버섯밭', clinic: '치료소', library: '도서관', market: '장터', dig: '공사장', garden: '정원', royal: '왕실' };
    const point = (x, y) => [ox + x * scale, oy + y * scale];
    if (this.scene === 'nest') {
      for (const edge of this.graph.edges) {
        if (edge.locked && !this.graph.open) continue;
        const a = this.graph.nodes[edge.a], b = this.graph.nodes[edge.b]; line(ctx, [point(a.x, a.y), point(b.x, b.y)], '#a19a6b', Math.max(2, 38 * scale));
      }
      for (const room of NEST_ROOMS) {
        const [x, y] = point(room.x, room.y); ellipse(ctx, x, y, room.rx * scale, room.ry * scale, room.id === 'royal' ? '#cfb475' : '#c2b184');
        if (detailed) label(ctx, shortRoomNames[room.id], x, y, '#343e2b', Math.max(8, Math.min(11, width / 50)));
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
    if (this.guide) {
      const [x, y] = point(this.guide.target.x, this.guide.target.y);
      ctx.beginPath(); ctx.arc(x, y, 10, 0, TAU); ctx.strokeStyle = '#f5dd93'; ctx.lineWidth = 2; ctx.stroke();
    }
    const [px, py] = point(this.player.x, this.player.y);
    ellipse(ctx, px, py, 7, 7, '#f5eee0'); ellipse(ctx, px, py, 4, 4, '#608675');
    label(ctx, '나', px, py - 15, '#fff3cd', 11);
    this.mapTransform = { scale, ox, oy, width, height };
  }

  moveToMap(x, y) {
    if (!this.mapTransform) return;
    const { scale, ox, oy } = this.mapTransform;
    const point = { x: (x - ox) / scale, y: (y - oy) / scale };
    if (this.scene === 'nest') this.path = this.graph.route(this.player, point);
    else { const resource = this.outsideEntities.filter(e => e.available !== false).sort((a, b) => distance(a, point) - distance(b, point))[0]; this.guide = { id: resource.id, target: resource, otherScene: false }; }
  }
}
