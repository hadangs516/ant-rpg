import test from 'node:test';
import assert from 'node:assert/strict';
import { RemoteStore } from '../src/storage.js';

function memory() {
  const values = new Map();
  return { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
}
const state = seconds => ({ version: 1, rank: 0, stats: { playSeconds: seconds } });
function harness(handler, options = {}) {
  const calls = [], statuses = [];
  const store = new RemoteStore({
    storage: memory(), sessionStorage: memory(), onStatus: s => statuses.push(s), ...options,
    fetch: async (url, options) => {
      const body = JSON.parse(options.body); calls.push({ url, options, body });
      const result = await handler(body);
      return { ok: true, json: async () => result };
    }
  });
  return { store, calls, statuses };
}

test('가입은 한글과 네 자리 문자열 PIN을 검증하고 0516을 보존한다', async () => {
  const { store, calls } = harness(() => ({ ok: true, token: '세션', revision: 0, loginCount: 1, state: null }));
  await assert.rejects(store.register('abc', '0516'), /한글/);
  await assert.rejects(store.register('개미', '516'), /네 자리/);
  await store.register('개미', '0516');
  assert.equal(calls[0].body.pin, '0516');
  assert.equal(calls[0].options.headers['Content-Type'], 'text/plain;charset=UTF-8');
  assert.notEqual(calls[0].options.mode, 'no-cors');
});

test('이전 저장 서버와 버전 없는 응답은 새 이야기 진행을 덮어쓰기 전에 차단한다', async () => {
  for (const serverVersion of [undefined, '1.0.2', '잘못된버전']) {
    const { store, calls } = harness(() => ({ ok: true, serverVersion, token: '세션', revision: 0, loginCount: 1, state: state(60) }), { requiredServerMajor: 2 });
    await assert.rejects(store.login('개미', '0516'), error => error.code === 'SERVER_SETUP' && /새 버전으로 배포/.test(error.message));
    assert.equal(store.id, null);
    assert.equal(store.token, null);
    assert.equal(store.loadLocal('개미'), null);
    assert.equal((await store.save(state(90))).ok, false);
    assert.equal(calls.length, 1);
  }
});

test('새 버전 저장 서버의 계정과 진행은 정상적으로 불러온다', async () => {
  const { store } = harness(() => ({ ok: true, serverVersion: '2.0.0', token: '세션', revision: 3, loginCount: 4, state: state(180) }), { requiredServerMajor: 2 });
  const result = await store.login('개미', '0516');
  assert.equal(result.state.stats.playSeconds, 180);
  assert.equal(store.revision, 3);
  assert.equal(store.id, '개미');
});

test('로그인 오류를 로컬 또는 체험 성공으로 바꾸지 않는다', async () => {
  const { store } = harness(() => ({ ok: false, code: 'BAD_CREDENTIALS', message: '아이디 또는 비밀번호를 확인해 주세요.' }));
  await assert.rejects(store.login('개미', '0516'), error => error.code === 'BAD_CREDENTIALS');
  assert.equal(store.id, null);
});

test('응답 없는 저장은 기기에 보관하고 다음 저장에서 같은 요청으로 재시도한다', async () => {
  let fail = false, revision = 0, previous;
  const { store, calls, statuses } = harness(body => {
    if (body.action === 'login') return { ok: true, token: '세션', revision, loginCount: 2, state: state(30) };
    if (fail) { fail = false; previous = body.requestId; throw new TypeError('network lost'); }
    if (previous) assert.equal(body.requestId, previous);
    previous = null;
    return { ok: true, revision: ++revision, savedAt: '2026-09-13', playSeconds: body.state.stats.playSeconds };
  });
  await store.login('개미', '0516');
  fail = true;
  assert.equal((await store.save(state(60))).ok, false);
  assert.equal(store.loadLocal('개미').stats.playSeconds, 60);
  assert.equal((await store.save(state(120))).ok, true);
  assert.equal(calls.at(-1).body.state.stats.playSeconds, 120);
  assert.equal(calls.at(-1).body.pin, undefined);
  assert.ok(statuses.some(s => s.kind === 'offline'));
});

test('동시에 호출한 저장은 직렬 처리되고 오래된 응답은 최신 기기 저장을 덮지 않는다', async () => {
  let revision = 0;
  const { store, calls } = harness(body => body.action === 'login'
    ? { ok: true, token: '세션', revision, loginCount: 1, state: state(0) }
    : { ok: true, revision: ++revision, playSeconds: body.state.stats.playSeconds });
  await store.login('개미', '0516');
  await Promise.all([store.save(state(60)), store.save(state(120)), store.save(state(180))]);
  const saves = calls.filter(c => c.body.action === 'save');
  assert.equal(saves.at(-1).body.state.stats.playSeconds, 180);
  assert.equal(store.loadLocal('개미').stats.playSeconds, 180);
  for (let i = 1; i < saves.length; i++) assert.equal(saves[i].body.revision, i);
});

test('새 기기 로그인으로 세션이 바뀌면 재로그인을 요구한다', async () => {
  const { store } = harness(body => body.action === 'login'
    ? { ok: true, token: '세션', revision: 0, loginCount: 1, state: null }
    : { ok: false, code: 'SESSION_CONFLICT', message: '다른 기기에서 로그인했습니다. 다시 로그인해 주세요.' });
  await store.login('개미', '0516');
  const result = await store.save(state(60));
  assert.equal(result.code, 'SESSION_CONFLICT');
  assert.equal(store.loadLocal('개미').stats.playSeconds, 60);
});

test('로그아웃은 계정 세션만 제거하고 계정별 복구 저장은 남긴다', async () => {
  const { store } = harness(body => body.action === 'login'
    ? { ok: true, token: '세션', revision: 0, loginCount: 1, state: null }
    : { ok: true, revision: 1 });
  await store.login('개미', '0516');
  await store.save(state(60));
  store.logout();
  assert.equal(store.id, null);
  assert.equal(store.loadLocal('개미').stats.playSeconds, 60);
  assert.equal((await store.save(state(90))).ok, false);
});

test('새로 로그인할 때 같은 서버 차수의 미전송 로컬 진행만 복원한다', async () => {
  const storage = memory();
  storage.setItem('ant-rpg:account:개미', JSON.stringify({ state: state(90), baseRevision: 2, dirty: true }));
  let revision = 2;
  const store = new RemoteStore({ storage, sessionStorage: memory(), fetch: async () => ({ ok: true,
    json: async () => ({ ok: true, token: '세션', revision, state: state(60), loginCount: 3 }) }) });
  const recovered = await store.login('개미', '0516');
  assert.equal(recovered.state.stats.playSeconds, 90);
  assert.equal(recovered.recoveredLocal, true);
  revision = 3;
  const newerCloud = await store.login('개미', '0516');
  assert.equal(newerCloud.state.stats.playSeconds, 60);
  assert.equal(newerCloud.recoveredLocal, false);
});

test('브라우저 저장 공간을 사용할 수 없어도 온라인 응답으로 저장을 확인한다', async () => {
  const storage = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  const store = new RemoteStore({ storage, sessionStorage: null, fetch: async (_url, options) => ({ ok: true,
    json: async () => JSON.parse(options.body).action === 'login'
      ? { ok: true, token: '세션', revision: 0, state: null, loginCount: 1 }
      : { ok: true, revision: 1, playSeconds: 60 } }) });
  await store.login('개미', '0516');
  assert.equal(store.saveLocal(state(60)), false);
  assert.equal((await store.save(state(60))).ok, true);
});

test('읽을 수 없는 응답과 잘못된 저장 차수는 온라인 성공으로 표시하지 않는다', async () => {
  const { store, statuses } = harness(body => body.action === 'login'
    ? { ok: true, token: '세션', revision: 0, state: null, loginCount: 1 }
    : { ok: true, revision: 0 });
  await store.login('개미', '0516');
  assert.equal((await store.save(state(60))).code, 'SERVER_SETUP');
  assert.ok(!statuses.some(status => status.message === '온라인 저장 완료'));
  const broken = new RemoteStore({ storage: memory(), sessionStorage: memory(), fetch: async () => ({ ok: true, json: async () => { throw new SyntaxError('HTML'); } }) });
  await assert.rejects(broken.login('개미', '0516'), error => error.code === 'SERVER_SETUP');
});

test('실제 브라우저의 AbortError를 네트워크 재시도 오류로 변환한다', async () => {
  const store = new RemoteStore({ storage: memory(), sessionStorage: memory(), fetch: async () => { throw new DOMException('aborted', 'AbortError'); } });
  await assert.rejects(store.login('개미', '0516'), error => error.code === 'NETWORK' && /응답이 늦습니다/.test(error.message));
});

test('새 로그인 소유권을 얻은 탭의 백업을 이전 탭이 덮어쓰지 못한다', async () => {
  const storage = memory();
  let token = 0, release;
  const wait = new Promise(resolve => { release = resolve; });
  const fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    if (body.action === 'login') return { ok: true, json: async () => ({ ok: true, token: String(++token), revision: 0, state: state(0), loginCount: token }) };
    await wait;
    return { ok: true, json: async () => ({ ok: true, revision: 1, playSeconds: 120 }) };
  };
  const oldTab = new RemoteStore({ storage, sessionStorage: null, fetch });
  await oldTab.login('개미', '0516');
  oldTab.saveLocal(state(50));
  const newTab = new RemoteStore({ storage, sessionStorage: null, fetch });
  await newTab.login('개미', '0516');
  const saving = newTab.save(state(120));
  assert.equal(oldTab.saveLocal(state(70)), false);
  assert.equal((await oldTab.save(state(70))).code, 'SESSION_CONFLICT');
  release();
  assert.equal((await saving).ok, true);
  assert.equal(newTab.loadLocal('개미').stats.playSeconds, 120);
});

test('저장 응답을 기다리는 중 다른 탭이 로그인하면 그 탭의 백업 차수를 건드리지 않는다', async () => {
  const storage = memory();
  let token = 0, release;
  const wait = new Promise(resolve => { release = resolve; });
  const fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    if (body.action === 'login') return { ok: true, json: async () => ({ ok: true, token: String(++token), revision: token === 1 ? 0 : 2, state: state(120), loginCount: token }) };
    await wait;
    return { ok: true, json: async () => ({ ok: true, revision: 1, playSeconds: 60 }) };
  };
  const oldTab = new RemoteStore({ storage, sessionStorage: null, fetch });
  await oldTab.login('개미', '0516');
  const saving = oldTab.save(state(60));
  const newTab = new RemoteStore({ storage, sessionStorage: null, fetch });
  await newTab.login('개미', '0516');
  newTab.saveLocal(state(150));
  const before = storage.getItem('ant-rpg:account:개미');
  release(); await saving;
  assert.equal(storage.getItem('ant-rpg:account:개미'), before);
});

test('로그아웃 후 늦게 도착한 로그인 응답은 접속을 되살리지 않는다', async () => {
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  const store = new RemoteStore({ storage: memory(), sessionStorage: memory(), fetch: () => wait });
  const pending = store.login('개미', '0516');
  store.logout();
  release({ ok: true, json: async () => ({ ok: true, token: '취소된세션', revision: 0, state: null, loginCount: 1 }) });
  await assert.rejects(pending, error => error.code === 'AUTH_CANCELLED');
  assert.equal(store.id, null);
  assert.equal(store.token, null);
});

test('뒤늦게 끝난 이전 로그인은 더 최근 로그인 계정을 바꾸지 않는다', async () => {
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  const fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    if (body.id === '먼저개미') return wait;
    return { ok: true, json: async () => ({ ok: true, token: '최근세션', revision: 0, state: null, loginCount: 1 }) };
  };
  const store = new RemoteStore({ storage: memory(), sessionStorage: null, fetch });
  const first = store.login('먼저개미', '0516');
  await store.login('나중개미', '0516');
  release({ ok: true, json: async () => ({ ok: true, token: '이전세션', revision: 0, state: null, loginCount: 1 }) });
  await assert.rejects(first, error => error.code === 'AUTH_CANCELLED');
  assert.equal(store.id, '나중개미');
  assert.equal(store.token, '최근세션');
});
