// Region coordinates are shared by movement, the world map and story interactions.
const room = (id, name, x, y, rx = 145, ry = 92, decor = 'rest') => ({ id, name, x, y, rx, ry, decor });
const story = (id, x, y, name = id, appearance = 'ant') => ({ id, name, type: 'story', x, y, appearance });
const portal = (scene, destination, x, y, name) => ({ id: `${scene}-문-${destination}`, type: 'portal', destination, x, y, name, appearance: 'door' });

export const REGIONS = {
  nest: { name: '우리 개미굴', width: 2500, height: 1980, entry: { x: 1260, y: 250 } },
  outside: { name: '햇살 정원', width: 2500, height: 1900, entry: { x: 1210, y: 1450 }, entities: [
    portal('outside', 'moss', 520, 400, '이끼 군락 입구'),
    portal('outside', 'reed', 2180, 1510, '갈대 군락 입구'),
    portal('outside', 'depths', 1960, 190, '잊힌 동굴 입구'),
    portal('outside', 'frontier', 2280, 1710, '변경 원정길'),
  ] },
  prison: {
    name: '돌뿌리 감옥', width: 920, height: 720, entry: { x: 310, y: 370 }, palette: ['#302c30', '#78705d', '#aa9270'],
    rooms: [room('cell', '이름을 잃은 방', 350, 375, 240, 165, 'prison'), room('crack', '서늘한 틈', 710, 280, 112, 83, 'crack')],
    corridors: [['cell', 'crack', [[530, 320], [600, 350]]]],
    entities: [story('간수', 190, 405, '간수 · 잔뿌리'), story('균열', 545, 312, '바람이 새는 균열', 'crack'),
      portal('prison', 'depths', 755, 287, '균열 너머 비밀 통로')],
  },
  depths: {
    name: '잊힌 뿌리 지하', width: 2100, height: 1500, entry: { x: 245, y: 280 }, palette: ['#222f32', '#5d716e', '#9cac8a'],
    rooms: [room('landing', '빛이 닿지 않는 계단', 280, 290, 170, 105, 'crack'), room('archive', '버려진 기록실', 810, 265, 165, 98, 'library'),
      room('water', '끊어진 물길', 1410, 390, 175, 100, 'water'), room('glow', '빛버섯 동굴', 1830, 710, 170, 120, 'fungus'),
      room('echo', '메아리의 쉼터', 1130, 835, 185, 106, 'rest'), room('gate', '오래된 약속의 문', 520, 850, 185, 106, 'gate'),
      room('rust', '녹슨 빗장', 620, 1270, 190, 106, 'gate'), room('lift', '왕실 아래 승강기', 1580, 1250, 185, 110, 'lift')],
    corridors: [['landing', 'archive', [[435, 430], [655, 390]]], ['archive', 'water', [[990, 220], [1180, 355]]],
      ['water', 'glow', [[1550, 550], [1720, 520]]], ['glow', 'echo', [[1720, 905], [1450, 895]]],
      ['echo', 'gate', [[925, 730], [735, 840]]], ['gate', 'rust', [[390, 1005], [500, 1150]]],
      ['echo', 'lift', [[1250, 1015], [1430, 1035]]], ['rust', 'lift', [[855, 1310], [1050, 1180], [1280, 1330]]]],
    entities: [story('돌개', 270, 317, '돌개 · 잊힌 굴착대장'), story('낡은기록', 850, 283, '이름이 지워진 기록', 'record'),
      story('물길', 1450, 420, '막힌 지하 물길', 'water'), story('빛버섯', 1860, 730, '푸른 빛버섯', 'mushroom'),
      story('메아리', 1110, 855, '메아리 · 지하 연락책'), story('길막힌문', 570, 870, '암호로 닫힌 문', 'gate'),
      story('녹슨문', 575, 1275, '녹슨 문과 흙더미', 'gate'), story('비밀승강기', 1540, 1240, '왕실로 향하는 승강기', 'lift'),
      portal('depths', 'outside', 700, 1290, '바깥으로 난 비밀 출구'), portal('depths', 'throne', 1685, 1260, '왕실 아래 통로')],
  },
  moss: {
    name: '이끼빛 군락', width: 1450, height: 1000, entry: { x: 225, y: 680 }, palette: ['#2a4037', '#668566', '#b2bf89'],
    rooms: [room('porch', '이끼빛 마중터', 245, 680, 155, 106, 'entrance'), room('meeting', '반딧불 광장', 730, 555, 230, 140, 'meeting'),
      room('spring', '마른 샘터', 1110, 255, 180, 105, 'water'), room('nursery', '작은 잎사귀 집', 1120, 775, 175, 102, 'nursery')],
    corridors: [['porch', 'meeting', [[420, 550], [555, 665]]], ['meeting', 'spring', [[875, 405], [1010, 420]]],
      ['meeting', 'nursery', [[815, 775], [945, 710]]]],
    entities: [story('초롱', 750, 582, '초롱 · 이끼빛 대표'), story('물길', 1140, 280, '목마른 군락의 샘', 'water'),
      portal('moss', 'outside', 195, 690, '햇살 정원으로')],
  },
  reed: {
    name: '갈대바람 군락', width: 1500, height: 1100, entry: { x: 265, y: 790 }, palette: ['#3c3830', '#9c8e64', '#d3c393'],
    rooms: [room('porch', '갈대다리 입구', 280, 780, 160, 108, 'entrance'), room('guard', '바람 경비대', 660, 465, 170, 106, 'guard'),
      room('square', '먼지빛 모임터', 1110, 420, 210, 130, 'meeting'), room('supply', '모래의 보급소', 1080, 840, 195, 104, 'pantry')],
    corridors: [['porch', 'guard', [[410, 595], [540, 635]]], ['guard', 'square', [[835, 365], [940, 445]]],
      ['square', 'supply', [[1250, 590], [1160, 665]]], ['porch', 'supply', [[495, 895], [740, 795], [870, 865]]]],
    entities: [story('수문장', 665, 488, '갈대 수문장'), story('모래', 1070, 850, '모래 · 바람 경비대장'),
      portal('reed', 'outside', 235, 794, '햇살 정원으로')],
  },
  throne: {
    name: '은빛 왕실', width: 1000, height: 800, entry: { x: 280, y: 595 }, palette: ['#352b34', '#998064', '#d4b789'],
    rooms: [room('throne', '마지막 왕관', 500, 410, 430, 305, 'royal')], corridors: [],
    entities: [story('은빛전투', 700, 330, '은빛 · 왕관의 주인', 'queen'),
      portal('throne', 'depths', 210, 595, '지하 승강기로'), portal('throne', 'nest', 485, 170, '우리 군락으로')],
  },
  frontier: {
    name: '붉은 모래 변경', width: 1700, height: 1200, entry: { x: 275, y: 845 }, palette: ['#463935', '#a97b57', '#d1ad79'],
    rooms: [room('camp', '원정대 야영지', 300, 845, 195, 122, 'guard'), room('bridge', '부서진 뿌리다리', 775, 535, 190, 115, 'crack'),
      room('fort', '붉은 모래 전초기지', 1310, 390, 235, 152, 'guard'), room('oasis', '새로운 씨앗터', 1170, 955, 195, 110, 'garden')],
    corridors: [['camp', 'bridge', [[515, 875], [610, 650]]], ['bridge', 'fort', [[955, 380], [1120, 470]]],
      ['bridge', 'oasis', [[805, 760], [990, 775]]]],
    entities: [story('원정깃발', 1330, 410, '전초기지의 깃발', 'flag'), portal('frontier', 'outside', 235, 860, '햇살 정원으로')],
  },
};

for (const [scene, region] of Object.entries(REGIONS)) {
  region.entities = (region.entities || []).map(entity => ({ ...entity, scene }));
}

export const ROOM_RANKS = { scout: 1, guard: 2, garden: 3, royal: 4 };
export const RANK_LABELS = ['일개미', '견습 일개미', '숙련 일개미', '작업대장', '여왕 후보', '여왕'];

// Pheromones use the very same network painted as paths in the garden.
export const GARDEN_TRAILS = [
  [[1210, 1390], [1150, 1190], [920, 1150], [530, 1100], [600, 875], [620, 550], [520, 400]],
  [[1210, 1390], [1510, 1450], [1770, 1420], [1980, 1250], [2070, 900], [2090, 470], [2180, 280], [1960, 190]],
  [[920, 1150], [1100, 970], [1190, 740], [1150, 500], [620, 550]],
  [[1100, 970], [1500, 990], [1570, 760], [1700, 610], [2090, 470]],
  [[1210, 1390], [1010, 1530], [790, 1580], [510, 1570]],
  [[1770, 1420], [2180, 1510], [2280, 1710]],
];
export const GARDEN_OBSTACLES = [
  { x: 390, y: 910, rx: 156, ry: 115, angle: -.4 },
  { x: 1740, y: 310, rx: 239, ry: 53, angle: .25 },
];
