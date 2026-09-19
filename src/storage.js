import { API_URL, VERSION } from './config.js';

const LOCAL_PREFIX = 'ant-rpg:account:';
const SESSION_KEY = 'ant-rpg:session';
const clone = value => JSON.parse(JSON.stringify(value));
const requestId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function storageOrNull(name) {
  try { return globalThis[name] || null; } catch { return null; }
}

function problem(message, code = 'NETWORK') {
  return Object.assign(new Error(message), { code });
}

/** Acknowledged POST requests only. Local backups never count as cloud saves. */
export class RemoteStore {
  constructor({ onStatus = () => {}, fetch = globalThis.fetch?.bind(globalThis),
    storage = storageOrNull('localStorage'), sessionStorage = storageOrNull('sessionStorage'),
    url = API_URL, timeout = 18000, requiredServerMajor = 0 } = {}) {
    this.onStatus = onStatus;
    this.fetch = fetch;
    this.storage = storage;
    this.sessionStorage = sessionStorage;
    this.url = url;
    this.timeout = timeout;
    this.requiredServerMajor = requiredServerMajor;
    this.id = null;
    this.token = null;
    this.revision = 0;
    this._pending = null;
    this._retry = null;
    this._draining = null;
    this._generation = 0;
    this._authGeneration = 0;
    this._ownerId = null;
    // Login is explicit after refresh. A stale tab never resumes a replaced session.
    try { this.sessionStorage?.removeItem(SESSION_KEY); } catch { /* private mode */ }
  }

  _status(kind, message) { this.onStatus({ kind, message }); }

  _localRecord(id) {
    try { return JSON.parse(this.storage?.getItem(LOCAL_PREFIX + id) || 'null'); }
    catch { return null; }
  }

  loadLocal(id) {
    const record = this._localRecord(id);
    return record?.state ? clone(record.state) : null;
  }

  saveLocal(state) {
    if (!this.id || !this._ownerId || !state || !this.storage) return false;
    try {
      const previous = this._localRecord(this.id);
      if (previous?.owner && previous.owner !== this._ownerId) return false;
      this.storage.setItem(LOCAL_PREFIX + this.id, JSON.stringify({
        state, baseRevision: this.revision, dirty: true, savedAt: Date.now(), owner: this._ownerId,
        pendingRequestId: previous?.pendingRequestId || null,
        pendingRevision: previous?.pendingRevision ?? null
      }));
      return true;
    } catch { return false; }
  }

  async _call(payload) {
    if (!this.url || !this.fetch) throw problem('온라인 저장 주소가 설정되지 않았습니다.', 'NOT_CONFIGURED');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await this.fetch(this.url, {
        method: 'POST', mode: 'cors', credentials: 'omit', redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(payload), signal: controller.signal
      });
      if (!response.ok) throw problem('저장 서버에 연결할 수 없습니다. 앱스 스크립트 배포 설정을 확인해 주세요.');
      let data;
      try { data = await response.json(); }
      catch { throw problem('저장 서버의 응답을 읽을 수 없습니다. 제공된 앱스 스크립트를 설치하고 새 버전으로 배포해 주세요.', 'SERVER_SETUP'); }
      if (!data || typeof data.ok !== 'boolean') {
        throw problem('게임 저장 서버가 아직 준비되지 않았습니다. 앱스 스크립트 설치가 필요합니다.', 'SERVER_SETUP');
      }
      if (!data.ok) throw problem(data.message || '요청을 처리하지 못했습니다.', data.code || 'SERVER_ERROR');
      return data;
    } catch (error) {
      if (typeof error.code === 'string') throw error;
      throw problem(error.name === 'AbortError'
        ? '서버 응답이 늦습니다. 연결을 확인한 뒤 다시 시도해 주세요.'
        : '저장 서버 연결에 실패했습니다. 인터넷 연결과 앱스 스크립트 공개 배포를 확인해 주세요.');
    } finally { clearTimeout(timer); }
  }

  async _authenticate(action, id, pin) {
    id = String(id || '').trim();
    pin = String(pin || '');
    if (!/^[가-힣]{2,12}$/.test(id)) throw problem('아이디는 한글만 두 글자부터 열두 글자까지 입력해 주세요.', 'INVALID_ID');
    if (!/^\d{4}$/.test(pin)) throw problem('비밀번호는 숫자 네 자리로 입력해 주세요.', 'INVALID_PIN');
    const authGeneration = ++this._authGeneration;
    const attempt = this._authAttempt;
    const authId = attempt?.action === action && attempt?.id === id && attempt?.pin === pin ? attempt.requestId : requestId();
    this._authAttempt = { action, id, pin, requestId: authId };
    let data;
    try { data = await this._call({ action, id, pin, requestId: authId, version: VERSION }); }
    catch (error) {
      if (authGeneration !== this._authGeneration) throw problem('이미 취소된 로그인 요청입니다.', 'AUTH_CANCELLED');
      if (error.code !== 'NETWORK') this._authAttempt = null;
      throw error;
    }
    if (authGeneration !== this._authGeneration) throw problem('이미 취소된 로그인 요청입니다.', 'AUTH_CANCELLED');
    if (!data.token || !Number.isSafeInteger(data.revision)) throw problem('로그인 응답이 올바르지 않습니다.', 'SERVER_SETUP');
    if (this.requiredServerMajor && !(Number(String(data.serverVersion||'0').split('.')[0]) >= this.requiredServerMajor)) {
      throw problem('운영자가 새 Apps Script를 붙여 넣고 새 버전으로 배포해야 합니다. 아직 이전 저장 서버가 연결되어 있어요.', 'SERVER_SETUP');
    }
    this._authAttempt = null;
    this._generation++;
    this.id = id;
    this.token = data.token;
    this.revision = data.revision;
    this._pending = null;
    this._retry = null;
    this._draining = null;
    this._ownerId = requestId();
    try { this.sessionStorage?.setItem(SESSION_KEY, JSON.stringify({ id, token: data.token, revision: data.revision })); } catch { /* memory session remains usable */ }
    const local = this._localRecord(id);
    // A lost response may have advanced the server by one revision. Recover only
    // when the server confirms this exact persisted request, never another save.
    const ownCommit = local?.pendingRequestId && local.pendingRequestId === data.lastSavedRequestId
      && local.pendingRevision === local.baseRevision && data.revision === local.baseRevision + 1
      && data.lastSavedRevision === data.revision;
    const recoveredLocal = Boolean(local?.state && local.dirty && (local.baseRevision === data.revision || ownCommit));
    const state = recoveredLocal ? clone(local.state) : data.state;
    // Claim the shared account backup on every successful login. Older tabs can
    // keep their in-memory world, but cannot replace this session's local save.
    try { this.storage?.setItem(LOCAL_PREFIX + id, JSON.stringify({ state, baseRevision: data.revision,
      dirty: recoveredLocal, savedAt: Date.now(), owner: this._ownerId, pendingRequestId: null, pendingRevision: null })); }
    catch { /* server remains authoritative when browser storage is unavailable */ }
    this._status(recoveredLocal ? 'offline' : 'saved', recoveredLocal ? '기기에 남은 진행을 복원했습니다. 다음 저장에 동기화합니다.' : '진행 상황을 불러왔습니다.');
    return { state, loginCount: Number(data.loginCount) || 1, recoveredLocal };
  }

  register(id, pin) { return this._authenticate('register', id, pin); }
  login(id, pin) { return this._authenticate('login', id, pin); }

  save(state) {
    if (!this.id || !this.token) return Promise.resolve({ ok: false, code: 'LOGIN_REQUIRED', message: '로그인이 필요합니다.' });
    const record = this._localRecord(this.id);
    if (record?.owner && record.owner !== this._ownerId) {
      this.token = null;
      const message = '다른 탭에서 로그인했습니다. 다시 로그인해 주세요.';
      this._status('error', message);
      return Promise.resolve({ ok: false, code: 'SESSION_CONFLICT', message });
    }
    const snapshot = clone(state);
    const local = this.loadLocal(this.id);
    if (snapshot.stats) snapshot.stats.playSeconds = Math.max(Number(snapshot.stats.playSeconds) || 0, Number(local?.stats?.playSeconds) || 0);
    this.saveLocal(snapshot);
    this._pending = snapshot;
    if (!this._draining) {
      const generation = this._generation;
      this._draining = this._drain(generation).finally(() => {
        if (generation === this._generation) this._draining = null;
      });
    }
    return this._draining;
  }

  async _drain(generation) {
    let result = { ok: true };
    while (generation === this._generation && (this._retry || this._pending)) {
      const payload = this._retry || {
        action: 'save', id: this.id, token: this.token, revision: this.revision,
        requestId: requestId(), state: this._pending, version: VERSION
      };
      if (!this._retry) this._pending = null;
      this._retry = payload;
      const beforeSend = this._localRecord(this.id);
      if (beforeSend?.owner === this._ownerId) {
        beforeSend.pendingRequestId = payload.requestId;
        beforeSend.pendingRevision = payload.revision;
        try { this.storage?.setItem(LOCAL_PREFIX + this.id, JSON.stringify(beforeSend)); } catch { /* normal online saving can proceed */ }
      }
      this._status('saving', '진행 상황을 저장하고 있습니다.');
      try {
        const data = await this._call(payload);
        if (generation !== this._generation) return { ok: false, code: 'SESSION_CHANGED' };
        if (!Number.isSafeInteger(data.revision) || data.revision !== payload.revision + 1) {
          throw problem('저장 응답의 차수가 올바르지 않습니다. 앱스 스크립트 배포 버전을 확인해 주세요.', 'SERVER_SETUP');
        }
        this.revision = data.revision;
        this._retry = null;
        const latest = this._localRecord(this.id);
        if (latest?.state && latest.owner === this._ownerId) {
          const same = JSON.stringify(latest.state) === JSON.stringify(payload.state);
          latest.baseRevision = data.revision;
          latest.dirty = !same;
          latest.pendingRequestId = null;
          latest.pendingRevision = null;
          if (latest.state.stats) latest.state.stats.playSeconds = Math.max(latest.state.stats.playSeconds || 0, data.playSeconds || 0);
          try { this.storage?.setItem(LOCAL_PREFIX + this.id, JSON.stringify(latest)); } catch { /* cloud acknowledgement still valid */ }
        }
        result = { ...data, ok: true };
      } catch (error) {
        if (generation !== this._generation) return { ok: false, code: 'SESSION_CHANGED' };
        const conflict = error.code === 'SESSION_CONFLICT' || error.code === 'REVISION_CONFLICT';
        if (conflict) this.token = null;
        const localExists = Boolean(this.loadLocal(this.id));
        this._status(error.code === 'NETWORK' ? 'offline' : 'error', conflict ? error.message
          : localExists ? '기기에 임시 저장했습니다. 온라인 저장은 연결 후 다시 시도합니다.' : '저장하지 못했습니다. 연결을 확인하고 즉시 저장을 다시 눌러 주세요.');
        return { ok: false, code: error.code, message: error.message, local: localExists };
      }
    }
    if (generation === this._generation) this._status('saved', '온라인 저장 완료');
    return result;
  }

  logout() {
    const payload = this.id && this.token ? { action: 'logout', id: this.id, token: this.token, requestId: requestId() } : null;
    this._generation++;
    this._authGeneration++;
    this.id = null;
    this.token = null;
    this._pending = null;
    this._retry = null;
    this._draining = null;
    this._authAttempt = null;
    this._ownerId = null;
    try { this.sessionStorage?.removeItem(SESSION_KEY); } catch { /* already cleared in memory */ }
    if (payload) this._call(payload).catch(() => {});
  }
}
