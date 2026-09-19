import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { QUESTS, RANKS } from '../src/content.js';
import { RemoteStore } from '../src/storage.js';
import { SCENES, STORY, normalizeCampaign } from '../src/campaign.js';

const source = fs.readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');

function backend() {
  const properties = new Map(), sheets = new Map();
  let uuid = 0, locked = false;
  class Range {
    constructor(sheet, r, c, h = 1, w = 1) { Object.assign(this, { sheet, r, c, h, w }); }
    getValues() { return Array.from({ length: this.h }, (_, y) => Array.from({ length: this.w }, (_, x) => this.sheet.rows[this.r + y - 1]?.[this.c + x - 1] ?? '')); }
    setValues(values) {
      values.forEach((row, y) => row.forEach((value, x) => {
        this.sheet.rows[this.r + y - 1] ||= [];
        this.sheet.rows[this.r + y - 1][this.c + x - 1] = value;
      }));
      return this;
    }
    setNumberFormat(value) {
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) this.sheet.formats.set(`${this.r + y},${this.c + x}`, value);
      return this;
    }
    setBackground() { return this; } setFontColor() { return this; } setFontWeight() { return this; }
    setWrap() { return this; } setVerticalAlignment() { return this; } createFilter() { return this; }
  }
  class Sheet {
    rows = []; formats = new Map(); columns = 26; maxRows = 1000;
    getLastRow() { return this.rows.length; } getMaxRows() { return this.maxRows; } getMaxColumns() { return this.columns; }
    getRange(...args) { return new Range(this, ...args); }
    insertColumnsAfter(_at, number) { this.columns += number; return this; }
    insertRowsAfter(_at, number) { this.maxRows += number; return this; }
    setFrozenRows() { return this; } setFrozenColumns() { return this; } setRowHeight() { return this; }
    setColumnWidth() { return this; } setColumnWidths() { return this; }
  }
  const spreadsheet = { getSheetByName: name => sheets.get(name), insertSheet: name => { const s = new Sheet(); sheets.set(name, s); return s; } };
  const props = { getProperty: key => properties.get(key) ?? null, setProperty: (key, value) => properties.set(key, value), deleteProperty: key => properties.delete(key) };
  const context = vm.createContext({
    console, Date, JSON, Math, Number, String, Object, Array, Error, isNaN,
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet, openById: () => spreadsheet },
    PropertiesService: { getScriptProperties: () => props },
    Utilities: { getUuid: () => `request-${++uuid}-token`, formatDate: () => '2026년 09월 13일 01시 00분 00초' },
    LockService: { getScriptLock: () => ({ tryLock: () => { locked = true; return true; }, hasLock: () => locked, releaseLock: () => { locked = false; } }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: value => ({ value, setMimeType() { return this; } }) }
  });
  vm.runInContext(source, context);
  const call = request => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(request) } }).value);
  const readRow = () => Object.fromEntries(sheets.get('플레이어').rows[0].map((key, index) => [key, sheets.get('플레이어').rows[1]?.[index]]));
  return { call, readRow, sheets, context, properties };
}

const campaign = () => ({
  '단계': 0, '진행': 0, '동맹': [], '감옥': '없음', '형기': 0, '침입': 0,
  '균열': 0, '암호순서': 0, '강화': { '이동': 0, '작업': 0, '운반': 0 },
  '통행증': [], '개통': false, '수색': [], '왕실체력': 100, '원정': 0,
  '모션': '없음', '집결': false, '긴급': null
});
const initial = (seconds = 0) => ({
  version: 1, rank: 1, xp: 140, questIndex: 2, questProgress: 1, completed: ['선배와 첫인사', '씨앗을 창고로'],
  inventory: { seed: 3, dew: 2, crumb: 1, leaf: 4, berry: 0 },
  stats: { playSeconds: seconds, gathered: 7, dug: 2, helped: 3, events: 1 },
  discoveries: ['반짝이는 이슬'], friendships: { 봄이: 2, 도담: 1 }, cleared: false, clearedAt: null,
  queen: { decor: 0, tributes: 0 }, world: { scene: 'outside', x: 300, y: 240, dug: 2, followers: 3, ambientWork: 27.5 }, settings: { bgm: .35, sfx: .6 }, campaign: campaign()
});
const register = (b, id = '작은개미') => b.call({ action: 'register', id, pin: '0516', requestId: 'register-0001' });
const save = (b, auth, seconds = 60, extra = {}) => b.call({ action: 'save', id: '작은개미', token: auth.token, revision: auth.revision, requestId: 'save-000001', state: initial(seconds), version: '2.0.0', ...extra });

test('구글 시트에 0516을 텍스트로 저장하고 한글 열과 복원 자료를 만든다', () => {
  const b = backend(), auth = register(b);
  assert.equal(auth.ok, true);
  assert.equal(auth.loginCount, 1);
  assert.equal(b.readRow()['네 자리 비밀번호'], '0516');
  assert.equal(b.sheets.get('플레이어').formats.get('2,2'), '@');
  assert.equal(save(b, auth).ok, true);
  const row = b.readRow();
  assert.equal(row['누적 플레이 시간'], '0시간 01분 00초');
  assert.equal(row['현재 등급'], '견습 일개미');
  assert.equal(row['현재 위치'], SCENES.outside);
  assert.equal(row['친구 관계'], '봄이 2 · 도담 1');
  assert.ok(Object.keys(row).every(name => !/[A-Za-z]/.test(name)));
  assert.ok(!/[A-Za-z]/.test(row['진행 복원 자료']));
});

test('한국어 진행 복원 자료는 로그인 시 원래 게임 상태로 돌아온다', () => {
  const b = backend(), auth = register(b);
  save(b, auth, 120);
  const login = b.call({ action: 'login', id: '작은개미', pin: '0516', requestId: 'login-000001' });
  assert.equal(login.ok, true);
  assert.deepEqual(login.state, initial(120));
  assert.equal(login.loginCount, 2);
  assert.equal(login.revision, 1);
});

test('즉위 시각은 한글 복원 자료에 숫자로 저장하고 원래 시각 문자열로 복원한다', () => {
  const b = backend(), auth = register(b);
  const state = { ...initial(1800), cleared: true, rank: 5, clearedAt: '2026-09-13T01:23:45.000Z' };
  assert.equal(save(b, auth, 1800, { state }).ok, true);
  const row = b.readRow();
  assert.ok(!/[A-Za-z]/.test(row['진행 복원 자료']));
  assert.equal(row['진행 중인 임무'], '여왕의 평온한 일상');
  const login = b.call({ action: 'login', id: '작은개미', pin: '0516', requestId: 'login-queen1' });
  assert.equal(login.state.clearedAt, state.clearedAt);
  assert.equal(login.state.cleared, true);
});

test('예전 세계 저장은 새 동료 수와 굴착조 누적 시간의 기본값으로 복원한다', () => {
  const b = backend(), auth = register(b), state = initial(120);
  delete state.world.followers; delete state.world.ambientWork;
  assert.equal(save(b, auth, 120, { state }).ok, true);
  const login = b.call({ action: 'login', id: '작은개미', pin: '0516', requestId: 'login-older1' });
  assert.equal(login.state.world.followers, 0);
  assert.equal(login.state.world.ambientWork, 0);
});

test('등록과 로그인 재전송은 계정과 로그인 횟수를 중복 생성하지 않는다', () => {
  const b = backend(), auth = register(b), repeated = register(b);
  assert.equal(repeated.token, auth.token);
  assert.equal(repeated.loginCount, 1);
  assert.equal(b.sheets.get('플레이어').getLastRow(), 2);
  const request = { action: 'login', id: '작은개미', pin: '0516', requestId: 'login-000002' };
  const login = b.call(request), retry = b.call(request);
  assert.equal(login.loginCount, 2);
  assert.equal(retry.loginCount, 2);
  assert.equal(retry.token, login.token);
});

test('같은 저장 요청 재시도는 한 번만 적용하고 누적 시간은 줄어들지 않는다', () => {
  const b = backend(), auth = register(b);
  const first = save(b, auth, 120), retry = save(b, auth, 120);
  assert.equal(first.revision, 1);
  assert.equal(retry.revision, 1);
  assert.equal(retry.repeated, true);
  const next = save(b, { ...auth, revision: 1 }, 60, { requestId: 'save-000002' });
  assert.equal(next.playSeconds, 120);
  assert.equal(b.readRow()['누적 플레이 초'], 120);
});

test('다른 기기 로그인은 이전 토큰의 덮어쓰기를 차단한다', () => {
  const b = backend(), auth = register(b);
  save(b, auth);
  const newSession = b.call({ action: 'login', id: '작은개미', pin: '0516', requestId: 'login-000003' });
  assert.notEqual(newSession.token, auth.token);
  assert.equal(save(b, auth, 0, { requestId: 'save-stale1' }).code, 'SESSION_CONFLICT');
  assert.equal(b.readRow()['누적 플레이 초'], 60);
});

test('오래된 저장 차수, 잘못된 비밀번호, 잘못된 아이디는 거부한다', () => {
  const b = backend(), auth = register(b);
  save(b, auth);
  assert.equal(save(b, auth, 90, { requestId: 'save-stale2' }).code, 'REVISION_CONFLICT');
  assert.equal(b.call({ action: 'login', id: '작은개미', pin: '0517', requestId: 'login-wrong1' }).code, 'BAD_CREDENTIALS');
  assert.equal(b.call({ action: 'register', id: '=IMPORTXML', pin: '0516', requestId: 'register-xx1' }).code, 'INVALID_ID');
  assert.equal(b.call({ action: 'register', id: '다른개미', pin: 516, requestId: 'register-xx2' }).code, 'INVALID_PIN');
});

test('계정마다 독립된 행에 저장하고 GET은 계정 정보를 반환하지 않는다', () => {
  const b = backend();
  register(b); register(b, '커다란개미');
  assert.equal(b.sheets.get('플레이어').getLastRow(), 3);
  const health = JSON.parse(b.context.doGet({ parameter: { id: '작은개미', pin: '0516' } }).value);
  assert.equal(health.ok, true);
  assert.equal(health.state, undefined);
  assert.equal(health.token, undefined);
  assert.ok(!JSON.stringify(health).includes('0516'));
});

test('로그아웃된 토큰을 다시 사용할 수 없다', () => {
  const b = backend(), auth = register(b);
  const logout = b.call({ action: 'logout', id: '작은개미', token: auth.token, requestId: 'logout-00001' });
  assert.equal(logout.ok, true);
  assert.equal(save(b, auth).code, 'SESSION_CONFLICT');
});

test('시트 제목 변경은 다른 열에 값을 잘못 쓰기 전에 발견한다', () => {
  const b = backend(), auth = register(b);
  b.sheets.get('플레이어').rows[0][0] = '틀린 제목';
  assert.equal(save(b, auth).code, 'SHEET_LAYOUT');
});

test('서버의 한국어 임무와 등급 표시는 실제 게임 콘텐츠와 일치한다', () => {
  const b = backend();
  assert.deepEqual(Array.from(b.context.QUEST_NAMES), QUESTS.map(quest => quest.title));
  assert.deepEqual(Array.from(b.context.RANK_NAMES), RANKS.map(rank => rank.name));
  assert.deepEqual(JSON.parse(JSON.stringify(b.context.SCENE_NAMES)), SCENES);
  assert.deepEqual(Array.from(b.context.STORY_NAMES), STORY.map(quest => quest?.title || ''));
});

test('0000 비밀번호와 이전 숫자 516으로 저장된 비밀번호도 일관되게 처리한다', () => {
  const b = backend();
  assert.equal(b.call({ action: 'register', id: '영개미', pin: '0000', requestId: 'register-zero' }).ok, true);
  assert.equal(b.readRow()['네 자리 비밀번호'], '0000');
  b.sheets.get('플레이어').rows[1][1] = 516;
  const login = b.call({ action: 'login', id: '영개미', pin: '0516', requestId: 'login-oldpin' });
  assert.equal(login.ok, true);
  assert.equal(b.readRow()['네 자리 비밀번호'], '0516');
});

test('실제 저장 클라이언트와 서버의 가입 저장 재접속 계약이 연결된다', async () => {
  const b = backend(), values = new Map();
  const store = new RemoteStore({
    storage: { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) }, sessionStorage: null,
    fetch: async (_url, options) => ({ ok: true, json: async () => b.call(JSON.parse(options.body)) })
  });
  assert.equal((await store.register('작은개미', '0516')).loginCount, 1);
  assert.equal((await store.save(initial(60))).ok, true);
  assert.equal((await store.save(initial(120))).ok, true);
  const login = await store.login('작은개미', '0516');
  assert.equal(login.loginCount, 2);
  assert.deepEqual(login.state, initial(120));
  assert.equal(b.readRow()['누적 플레이 초'], 120);
});

test('서버 저장 응답을 잃어도 새로고침 후 그 뒤의 오프라인 진행까지 복원한다', async () => {
  const b = backend(), values = new Map();
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  let loseResponse = true;
  const fetch = async (_url, options) => {
    const request = JSON.parse(options.body), response = b.call(request);
    if (request.action === 'save' && loseResponse) { loseResponse = false; throw new TypeError('response lost after commit'); }
    return { ok: true, json: async () => response };
  };
  const first = new RemoteStore({ storage, sessionStorage: null, fetch });
  await first.register('작은개미', '0516');
  assert.equal((await first.save(initial(60))).ok, false);
  assert.equal(b.readRow()['누적 플레이 초'], 60);
  first.saveLocal({ ...initial(120), questIndex: 7 });
  const reloaded = new RemoteStore({ storage, sessionStorage: null, fetch });
  const login = await reloaded.login('작은개미', '0516');
  assert.equal(login.recoveredLocal, true);
  assert.equal(login.state.stats.playSeconds, 120);
  assert.equal(login.state.questIndex, 7);
  assert.equal((await reloaded.save(login.state)).ok, true);
  assert.equal(b.readRow()['누적 플레이 초'], 120);
});

test('잃은 응답의 요청 표식은 로그아웃 뒤에도 복구 확인에만 사용할 수 있다', async () => {
  const b = backend(), auth = register(b);
  save(b, auth, 60);
  b.call({ action: 'logout', id: '작은개미', token: auth.token, requestId: 'logout-acked' });
  const login = b.call({ action: 'login', id: '작은개미', pin: '0516', requestId: 'login-acked1' });
  assert.equal(login.lastSavedRequestId, 'save-000001');
  assert.equal(login.lastSavedRevision, 1);
  assert.equal(save(b, auth, 120, { requestId: 'save-afterlogout', revision: 1 }).code, 'SESSION_CONFLICT');
});

test('다른 기기가 저장한 한 차수 앞의 진행은 잃은 응답으로 오인하지 않는다', async () => {
  const b = backend(), values = new Map();
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  let unavailable = false;
  const fetch = async (_url, options) => {
    if (unavailable) throw new TypeError('offline before request');
    return { ok: true, json: async () => b.call(JSON.parse(options.body)) };
  };
  const oldDevice = new RemoteStore({ storage, sessionStorage: null, fetch });
  await oldDevice.register('작은개미', '0516');
  unavailable = true;
  await oldDevice.save({ ...initial(120), questIndex: 8 });
  const other = b.call({ action: 'login', id: '작은개미', pin: '0516', requestId: 'login-other1' });
  assert.equal(save(b, other, 90, { requestId: 'save-other1', state: { ...initial(90), questIndex: 6 } }).ok, true);
  unavailable = false;
  const reloaded = new RemoteStore({ storage, sessionStorage: null, fetch });
  const login = await reloaded.login('작은개미', '0516');
  assert.equal(login.recoveredLocal, false);
  assert.equal(login.state.questIndex, 6);
  assert.equal(login.state.stats.playSeconds, 90);
});

test('새 이야기와 모든 지역을 한글로 기록하고 재로그인 시 정확히 복원한다', () => {
  const scenes = SCENES;
  for (const [scene, name] of Object.entries(scenes)) {
    const b = backend(), auth = register(b), state = initial(3456);
    state.world.scene = scene;
    Object.assign(state.campaign, {
      '단계': 18, '진행': 3, '동맹': ['돌개', '초롱'], '감옥': '이야기', '형기': 20.5,
      '침입': 2, '균열': 4, '암호순서': 3, '강화': { '이동': 3, '작업': 2, '운반': 1 },
      '통행증': ['이끼', '갈대'], '개통': true, '수색': ['낡은기록', '빛버섯'],
      '왕실체력': 46, '원정': 2, '모션': '격려', '집결': true,
      '긴급': { '종류': '천적', '남은초': 117.5, '진척': 11.2, '지시': true, '실패': false }
    });
    assert.equal(save(b, auth, 3456, { state }).ok, true);
    const row = b.readRow(), data = JSON.parse(row['진행 복원 자료']);
    assert.equal(row['현재 위치'], name);
    assert.equal(row['게임 버전'], '2.0.0');
    assert.equal(Object.keys(row).length, 31);
    assert.ok(!/[A-Za-z]/.test(row['진행 복원 자료']));
    assert.equal(data['새 이야기']['개통'], '예');
    assert.equal(data['새 이야기']['긴급']['실패'], '아니요');
    const login = b.call({ action: 'login', id: '작은개미', pin: '0516', requestId: 'login-region' });
    assert.equal(login.serverVersion, '2.0.0');
    assert.deepEqual(login.state, state);
  }
});

test('구버전 저장의 계정과 임무 진행은 보존하고 즉위와 개통 여부만 안전하게 이전한다', () => {
  for (const cleared of [false, true]) {
    const b = backend(), auth = register(b), state = initial(2000);
    state.cleared = cleared; state.rank = cleared ? 5 : 1;
    state.world.dug = 5;
    delete state.campaign;
    assert.equal(save(b, auth, 2000, { state }).ok, true);
    // Simulate a row written by the prior deployment, not a v2 save request.
    const sheet = b.sheets.get('플레이어'), data = JSON.parse(b.readRow()['진행 복원 자료']);
    delete data['새 이야기'];
    sheet.rows[1][30] = JSON.stringify(data);
    const login = b.call({ action: 'login', id: '작은개미', pin: '0516', requestId: 'login-legacy' });
    assert.equal(login.state.campaign['단계'], cleared ? 24 : 0);
    assert.equal(login.state.campaign['개통'], true);
    const { campaign: restoredCampaign, ...restored } = login.state;
    assert.deepEqual(restored, state);
    assert.equal(login.loginCount, 2);
    assert.equal(login.revision, 1);
    assert.equal(b.readRow()['네 자리 비밀번호'], '0516');
  }
});

test('새 게임은 자동 굴착이 쌓여도 개통 완료를 임의로 만들지 않는다', () => {
  const b = backend(), auth = register(b), state = initial(60);
  state.world.dug = 999;
  assert.equal(save(b, auth, 60, { state }).ok, true);
  const login = b.call({ action: 'login', id: '작은개미', pin: '0516', requestId: 'login-closed' });
  assert.equal(login.state.campaign['개통'], false);
});

test('새 이야기의 잘못된 수치와 알 수 없는 값을 제한하고 영문 항목은 시트로 내보내지 않는다', () => {
  const b = backend(), auth = register(b), state = initial(60);
  Object.assign(state.campaign, {
    '단계': 999, '진행': -5, '동맹': ['돌개', '돌개', 'unknown'], '감옥': 'unknown',
    '형기': -2, '침입': 200, '균열': 100, '암호순서': 20,
    '강화': { '이동': -1, '작업': 100, '운반': 2.8, 'unknown': 90 },
    '통행증': ['이끼', '이끼', 'unknown'], '수색': ['낡은기록', '영어english', 'unknown'],
    '왕실체력': 123, '원정': -1, '모션': 'unknown', '집결': 'yes',
    '긴급': { '종류': '비', '남은초': -1, '진척': 999, '지시': true, '실패': false, 'unknown': 'bad' },
    'unknown': 'untrusted'
  });
  state.world.scene = 'unknown';
  assert.equal(save(b, auth, 60, { state }).ok, true);
  const login = b.call({ action: 'login', id: '작은개미', pin: '0516', requestId: 'login-bounds' });
  const actual = login.state.campaign;
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(campaign()).sort());
  assert.equal(actual['단계'], 24); assert.equal(actual['진행'], 0);
  assert.deepEqual(actual['동맹'], ['돌개']); assert.equal(actual['감옥'], '없음');
  assert.equal(actual['형기'], 0); assert.equal(actual['침입'], 3);
  assert.equal(actual['균열'], 5); assert.equal(actual['암호순서'], 5);
  assert.deepEqual(actual['강화'], { '이동': 0, '작업': 3, '운반': 2 });
  assert.deepEqual(actual['통행증'], ['이끼']);
  assert.deepEqual(actual['수색'], ['낡은기록', '영어']);
  assert.equal(actual['왕실체력'], 100); assert.equal(actual['원정'], 0);
  assert.equal(actual['모션'], '없음'); assert.equal(actual['집결'], false);
  assert.deepEqual(actual['긴급'], { '종류': '비', '남은초': 0, '진척': 12, '지시': true, '실패': false });
  assert.equal(login.state.world.scene, 'nest');
  assert.ok(!/[A-Za-z]/.test(b.readRow()['진행 복원 자료']));
});

test('저장 서버 상태와 가입 응답에서 배포 버전을 확인할 수 있다', () => {
  const b = backend(), auth = register(b);
  assert.equal(JSON.parse(b.context.doGet().value).version, '2.0.0');
  assert.equal(auth.serverVersion, '2.0.0');
});

test('구버전 장면 이름과 명시한 소리 설정을 유지하고 누락된 배경음만 새 기본값을 쓴다', () => {
  const b = backend();
  const aliases = { '개미굴 안': 'nest', '개미굴 밖': 'outside', '여왕의 방': 'throne', '변경 지대': 'frontier' };
  for (const [label, scene] of Object.entries(aliases)) {
    const encoded = b.context.encodeState_(b.context.normalize_(initial()));
    encoded['위치']['장면'] = label;
    assert.equal(b.context.decodeState_(JSON.stringify(encoded)).world.scene, scene);
  }
  const saved = initial();
  assert.equal(b.context.normalize_(saved).settings.bgm, .35);
  saved.settings.bgm = 0;
  assert.equal(b.context.normalize_(saved).settings.bgm, 0);
  delete saved.settings.bgm;
  assert.equal(b.context.normalize_(saved).settings.bgm, .65);
});

test('추가 이야기의 현재 임무와 진행도 및 동맹을 읽기 쉬운 시트 열에 표시한다', () => {
  for (let phase = 1; phase < STORY.length; phase++) {
    const b = backend(), auth = register(b), state = initial();
    Object.assign(state.campaign, { '단계': phase, '진행': 2, '동맹': ['돌개'], '수색': ['지워진 이름들'] });
    assert.equal(save(b, auth, 0, { state }).ok, true);
    const row = b.readRow();
    assert.equal(row['진행 중인 임무'], STORY[phase].title);
    assert.equal(row['임무 진행'], 2);
    assert.ok(row['발견 기록'].includes('지워진 이름들'));
    assert.ok(row['친구 관계'].includes('동맹 돌개'));
  }
});

test('새 이야기의 경계값은 클라이언트와 서버에서 동일하게 정규화된다', () => {
  const b = backend(), state = initial();
  Object.assign(state.campaign, { '수색': Array.from({length: 40}, (_, i) => `기록 ${i}`), '긴급': { '종류': '천적', '남은초': 800, '진척': 50 } });
  assert.deepEqual(JSON.parse(JSON.stringify(b.context.normalize_(state).campaign)), normalizeCampaign(state.campaign));
});
