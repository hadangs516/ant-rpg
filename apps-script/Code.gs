/* 개미 키우기 RPG · 구글 시트 저장 서버 · 1.0.0
 * 이 파일 전체를 게임 전용 시트의 확장 프로그램 → Apps Script에 붙여 넣으세요.
 * 처음 한 번 시트준비 함수를 실행한 후 웹 앱으로 배포합니다.
 */

var GAME_VERSION = '1.0.0';
var SHEET_NAME = '플레이어';
var HEADERS = [
  '사용자 아이디', '네 자리 비밀번호', '가입 시각', '최근 로그인 시각', '최근 저장 시각',
  '로그인 횟수', '누적 플레이 시간', '누적 플레이 초', '현재 등급', '공헌도',
  '진행 중인 임무', '임무 진행', '완료한 임무 수', '클리어 여부', '즉위 시각', '현재 위치',
  '씨앗', '이슬', '과자 부스러기', '잎 조각', '열매', '채집 횟수', '굴착 횟수',
  '도움 횟수', '사건 해결 횟수', '발견 기록', '친구 관계', '여왕 생활',
  '게임 버전', '저장 차수', '진행 복원 자료'
];
var RANK_NAMES = ['갓 태어난 일개미', '견습 일개미', '숙련 일개미', '작업대장', '여왕 후보', '여왕개미'];
var QUEST_NAMES = [
  '처음 만난 선배', '작은 식구의 이불', '첫 번째 바깥나들이', '창고에 놓는 첫 선물', '벽 너머의 내일', '작은 일개미의 배지',
  '물방울 속의 하늘', '버섯 정원의 작은 찻잔', '길을 기억하는 방법', '바람에 날린 초록 조각', '비가 와도 보송하게', '돌아가지 않아도 되는 길',
  '하나, 둘, 함께!', '우리보다 커다란 간식', '나누면 더 맛있어', '누군가의 첫걸음', '집이 보이는 언덕', '겁이 나도 함께 서기',
  '붉은 열매 원정대', '이웃을 위한 식탁', '모두의 발자국이 모이는 곳', '비 오기 전에', '대장도 쉬어 가요', '함께라서 할 수 있는 일',
  '왕관보다 먼저 준비할 것', '굴마다 초록 리본', '모든 식구가 안심하도록', '가장 작은 식구와의 약속', '왕관은 함께 드는 것', '우리의 여왕'
];
var COL = {};
HEADERS.forEach(function (name, index) { COL[name] = index; });

function onOpen() {
  SpreadsheetApp.getUi().createMenu('개미 키우기').addItem('시트 준비하기', '시트준비').addToUi();
}

function 시트준비() {
  var sheet = sheet_();
  var notes = spreadsheet_().getSheetByName('읽어 주세요') || spreadsheet_().insertSheet('읽어 주세요');
  notes.getRange(1, 1, 9, 2).setValues([
    ['개미 키우기 저장 안내', '내용'],
    ['사용자 아이디', '한글 두 글자부터 열두 글자까지 사용합니다.'],
    ['네 자리 비밀번호', '문자열로 저장하므로 첫 자리 영을 유지합니다. 비밀번호 열의 텍스트 서식을 바꾸지 마세요.'],
    ['누적 플레이 시간', '게임 화면에서 실제로 플레이한 시간을 매분 저장합니다. 숨겨진 탭이나 메뉴 시간은 제외합니다.'],
    ['로그인 횟수', '가입 시 첫 접속을 포함하며 로그인에 성공할 때마다 한 번 증가합니다. 통신 재시도는 중복 계산하지 않습니다.'],
    ['진행 복원 자료', '한국어 항목으로 된 복원 자료입니다. 복원 자료와 저장 차수는 직접 수정하지 마세요.'],
    ['연결 실패', '기기에 임시 저장한 뒤 연결을 회복하면 다시 저장합니다. 다른 기기의 최신 저장과 충돌하면 재로그인합니다.'],
    ['운영 참고', '공개 웹 앱과 개인용 시트를 함께 사용합니다. 시트 자체는 공개하지 않습니다.'],
    ['시트 열 관리', '플레이어 시트의 열 순서와 첫 줄 제목을 유지해 주세요. 정렬과 필터는 자유롭게 사용할 수 있습니다.']
  ]);
  notes.getRange(1, 1, 1, 2).setBackground('#283a29').setFontColor('#ffffff').setFontWeight('bold');
  notes.setColumnWidth(1, 180).setColumnWidth(2, 700);
  notes.getRange(1, 1, 9, 2).setWrap(true).setVerticalAlignment('middle');
  notes.setFrozenRows(1);
  return '플레이어 시트와 안내 시트를 준비했습니다.';
}

function spreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('스프레드시트아이디');
  var spreadsheet = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) fail_('SERVER_SETUP', '연결할 시트가 없습니다. 시트에서 스크립트를 열거나 스프레드시트아이디 속성을 설정해 주세요.');
  return spreadsheet;
}

function sheet_() {
  var spreadsheet = spreadsheet_();
  var sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
  if (sheet.getMaxColumns() < HEADERS.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), HEADERS.length - sheet.getMaxColumns());
  if (!sheet.getLastRow()) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length).setBackground('#283a29').setFontColor('#ffffff').setFontWeight('bold').setWrap(true);
    sheet.setFrozenRows(1).setFrozenColumns(2);
    sheet.setRowHeight(1, 46);
    sheet.setColumnWidths(1, HEADERS.length, 120);
    sheet.setColumnWidths(3, 3, 200);
    sheet.setColumnWidth(7, 155).setColumnWidth(11, 230).setColumnWidth(26, 280).setColumnWidth(27, 280).setColumnWidth(31, 440);
    sheet.getRange(1, 1, sheet.getMaxRows(), HEADERS.length).createFilter();
  } else {
    var actual = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
    if (HEADERS.some(function (name, index) { return actual[index] !== name; })) {
      fail_('SHEET_LAYOUT', '플레이어 시트의 첫 줄 제목이나 열 순서가 변경되었습니다. 원래 제목과 순서를 복원해 주세요.');
    }
  }
  return sheet;
}

function fail_(code, message) { var error = new Error(message); error.code = code; throw error; }
function json_(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }
function stamp_() { return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy년 MM월 dd일 HH시 mm분 ss초'); }
function text_(value, max) { return typeof value === 'string' ? value.slice(0, max || 300) : ''; }
function integer_(value, max) { return Math.min(max || 1000000000, Math.max(0, Math.floor(Number(value) || 0))); }
function decimal_(value, fallback, min, max) { var number = Number(value); return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback; }
function korean_(value) { return text_(value, 100).replace(/[^가-힣ㄱ-ㅎㅏ-ㅣ0-9\s.,!?·()~+%★♥-]/g, '').trim(); }
function list_(value) { return Array.isArray(value) ? value.slice(0, 300).map(korean_).filter(Boolean) : []; }

function normalize_(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1) fail_('INVALID_STATE', '진행 자료의 형식이 올바르지 않습니다.');
  var inventory = raw.inventory || {}, stats = raw.stats || {}, world = raw.world || {}, settings = raw.settings || {}, queen = raw.queen || {};
  var friendships = {};
  Object.keys(raw.friendships || {}).slice(0, 100).forEach(function (key) {
    var name = korean_(key); if (name) friendships[name] = integer_(raw.friendships[key], 1000000);
  });
  return {
    version: 1, rank: integer_(raw.rank, 5), xp: integer_(raw.xp), questIndex: integer_(raw.questIndex, 1000),
    questProgress: integer_(raw.questProgress), completed: list_(raw.completed),
    inventory: { seed: integer_(inventory.seed), dew: integer_(inventory.dew), crumb: integer_(inventory.crumb), leaf: integer_(inventory.leaf), berry: integer_(inventory.berry) },
    stats: { playSeconds: integer_(stats.playSeconds), gathered: integer_(stats.gathered), dug: integer_(stats.dug), helped: integer_(stats.helped), events: integer_(stats.events) },
    discoveries: list_(raw.discoveries), friendships: friendships, cleared: raw.cleared === true,
    clearedAt: typeof raw.clearedAt === 'number' ? integer_(raw.clearedAt, 10000000000000) : raw.clearedAt ? text_(raw.clearedAt, 40) : null,
    queen: { decor: integer_(queen.decor), tributes: integer_(queen.tributes) },
    world: { scene: world.scene === 'outside' ? 'outside' : 'nest', x: decimal_(world.x, 0, -100000, 100000), y: decimal_(world.y, 0, -100000, 100000), dug: integer_(world.dug), followers: integer_(world.followers, 5), ambientWork: decimal_(world.ambientWork, 0, 0, 159.999) },
    settings: { bgm: decimal_(settings.bgm, .35, 0, 1), sfx: decimal_(settings.sfx, .6, 0, 1) }
  };
}

function encodeState_(state) {
  return {
    '자료 형식': state.version, '등급 단계': state.rank, '공헌도': state.xp,
    '임무 순서': state.questIndex, '임무 진행': state.questProgress, '완료 임무': state.completed,
    '보유 자원': { '씨앗': state.inventory.seed, '이슬': state.inventory.dew, '과자 부스러기': state.inventory.crumb, '잎 조각': state.inventory.leaf, '열매': state.inventory.berry },
    '활동 기록': { '플레이 초': state.stats.playSeconds, '채집': state.stats.gathered, '굴착': state.stats.dug, '도움': state.stats.helped, '사건 해결': state.stats.events },
    '발견 기록': state.discoveries, '친구 관계': state.friendships, '클리어': state.cleared ? '예' : '아니요',
    '즉위 시각': state.clearedAt ? new Date(state.clearedAt).getTime() || '' : '', '여왕 생활': { '장식': state.queen.decor, '진상품': state.queen.tributes },
    '위치': { '장면': state.world.scene === 'nest' ? '개미굴 안' : '개미굴 밖', '가로': state.world.x, '세로': state.world.y, '굴착': state.world.dug, '동료 수': state.world.followers, '굴착조 작업 초': state.world.ambientWork },
    '소리 설정': { '배경 음악': state.settings.bgm, '효과음': state.settings.sfx }
  };
}

function decodeState_(json) {
  if (!json) return null;
  var data;
  try { data = JSON.parse(json); } catch (_) { fail_('DAMAGED_SAVE', '진행 복원 자료를 읽지 못했습니다. 시트의 해당 행을 확인해 주세요.'); }
  var items = data['보유 자원'] || {}, stats = data['활동 기록'] || {}, world = data['위치'] || {}, settings = data['소리 설정'] || {}, queen = data['여왕 생활'] || {};
  return normalize_({
    version: data['자료 형식'], rank: data['등급 단계'], xp: data['공헌도'], questIndex: data['임무 순서'], questProgress: data['임무 진행'], completed: data['완료 임무'],
    inventory: { seed: items['씨앗'], dew: items['이슬'], crumb: items['과자 부스러기'], leaf: items['잎 조각'], berry: items['열매'] },
    stats: { playSeconds: stats['플레이 초'], gathered: stats['채집'], dug: stats['굴착'], helped: stats['도움'], events: stats['사건 해결'] },
    discoveries: data['발견 기록'], friendships: data['친구 관계'], cleared: data['클리어'] === '예',
    clearedAt: typeof data['즉위 시각'] === 'number' ? new Date(data['즉위 시각']).toISOString() : data['즉위 시각'] || null,
    queen: { decor: queen['장식'], tributes: queen['진상품'] },
    world: { scene: world['장면'] === '개미굴 밖' ? 'outside' : 'nest', x: world['가로'], y: world['세로'], dug: world['굴착'], followers: world['동료 수'], ambientWork: world['굴착조 작업 초'] },
    settings: { bgm: settings['배경 음악'], sfx: settings['효과음'] }
  });
}

function duration_(seconds) {
  return Math.floor(seconds / 3600) + '시간 ' + String(Math.floor(seconds / 60) % 60).padStart(2, '0') + '분 ' + String(seconds % 60).padStart(2, '0') + '초';
}

function writeProgress_(row, state, version) {
  var set = function (name, value) { row[COL[name]] = value; };
  var seconds = Math.max(integer_(row[COL['누적 플레이 초']]), state.stats.playSeconds);
  state.stats.playSeconds = seconds;
  set('최근 저장 시각', stamp_()); set('누적 플레이 시간', duration_(seconds)); set('누적 플레이 초', seconds);
  set('현재 등급', RANK_NAMES[state.rank]); set('공헌도', state.xp);
  set('진행 중인 임무', state.cleared ? '여왕의 평온한 일상' : QUEST_NAMES[state.questIndex] || '주요 임무 ' + (state.questIndex + 1) + '번째');
  set('임무 진행', state.questProgress); set('완료한 임무 수', state.completed.length);
  set('클리어 여부', state.cleared ? '클리어' : '성장 중');
  var date = state.clearedAt ? new Date(state.clearedAt) : null;
  set('즉위 시각', date && !isNaN(date.getTime()) ? Utilities.formatDate(date, 'Asia/Seoul', 'yyyy년 MM월 dd일 HH시 mm분 ss초') : '아직 즉위하지 않음');
  set('현재 위치', state.world.scene === 'nest' ? '개미굴 안' : '개미굴 밖');
  ['seed', 'dew', 'crumb', 'leaf', 'berry'].forEach(function (key, index) { row[16 + index] = state.inventory[key]; });
  set('채집 횟수', state.stats.gathered); set('굴착 횟수', state.stats.dug); set('도움 횟수', state.stats.helped); set('사건 해결 횟수', state.stats.events);
  set('발견 기록', state.discoveries.join(' · ') || '아직 없음');
  set('친구 관계', Object.keys(state.friendships).map(function (name) { return name + ' ' + state.friendships[name]; }).join(' · ') || '첫 만남을 기다리는 중');
  set('여왕 생활', '장식 ' + state.queen.decor + '개 · 진상품 ' + state.queen.tributes + '개');
  set('게임 버전', /^\d+\.\d+\.\d+$/.test(version || '') ? version : GAME_VERSION);
  var json = JSON.stringify(encodeState_(state));
  if (json.length > 45000) fail_('SAVE_TOO_LARGE', '진행 자료가 저장 가능한 크기를 초과했습니다.');
  set('진행 복원 자료', json);
}

function findRow_(sheet, id) {
  var count = sheet.getLastRow() - 1;
  if (count < 1) return 0;
  var ids = sheet.getRange(2, 1, count, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === id) return i + 2;
  return 0;
}

function writeRow_(sheet, rowNumber, row) {
  if (rowNumber > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 100);
  // Apply plain text BEFORE writing. Never convert the PIN to a number.
  sheet.getRange(rowNumber, 1, 1, HEADERS.length).setNumberFormat('@');
  sheet.getRange(rowNumber, 1, 1, HEADERS.length).setValues([row]).setVerticalAlignment('middle');
  sheet.getRange(rowNumber, 1, 1, HEADERS.length).setBackground(rowNumber % 2 ? '#f2f5eb' : '#ffffff');
}

function session_(id) {
  var raw = PropertiesService.getScriptProperties().getProperty('접속_' + id);
  try { return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
}
function putSession_(id, session) { PropertiesService.getScriptProperties().setProperty('접속_' + id, JSON.stringify(session)); }
function authResult_(row, session) {
  return { ok: true, token: session.token, revision: integer_(row[COL['저장 차수']]), loginCount: integer_(row[COL['로그인 횟수']]),
    lastSavedRequestId: session.lastRequest || null, lastSavedRevision: integer_(session.lastRevision),
    state: decodeState_(row[COL['진행 복원 자료']]) };
}

/** Health information only: GET never reads accounts, PINs or progress. */
function doGet() {
  return json_({ ok: true, game: '개미 키우기 RPG', version: GAME_VERSION, message: '저장 서버가 응답합니다. 계정과 진행 요청은 본문으로만 받습니다.' });
}

function doPost(event) {
  var lock = LockService.getScriptLock();
  try {
    if (!event || !event.postData || !event.postData.contents || event.postData.contents.length > 100000) fail_('INVALID_REQUEST', '요청 자료가 올바르지 않습니다.');
    var request;
    try { request = JSON.parse(event.postData.contents); } catch (_) { fail_('INVALID_REQUEST', '요청 자료를 읽을 수 없습니다.'); }
    if (!request || typeof request !== 'object') fail_('INVALID_REQUEST', '요청 자료가 올바르지 않습니다.');
    if (typeof request.id !== 'string' || !/^[가-힣]{2,12}$/.test(request.id)) fail_('INVALID_ID', '아이디는 한글만 두 글자부터 열두 글자까지 입력해 주세요.');
    if (typeof request.requestId !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(request.requestId)) fail_('INVALID_REQUEST', '요청 표식이 올바르지 않습니다.');
    if (!lock.tryLock(10000)) fail_('BUSY', '다른 저장을 처리하고 있습니다. 잠시 후 다시 시도해 주세요.');
    var sheet = sheet_(), rowNumber = findRow_(sheet, request.id);
    var row = rowNumber ? sheet.getRange(rowNumber, 1, 1, HEADERS.length).getValues()[0] : null;
    var session = session_(request.id);
    if (request.action === 'register' || request.action === 'login') {
      if (typeof request.pin !== 'string' || !/^\d{4}$/.test(request.pin)) fail_('INVALID_PIN', '비밀번호는 숫자 네 자리 문자열이어야 합니다.');
      if (row && String(row[COL['네 자리 비밀번호']]).padStart(4, '0') === request.pin && session && session.authRequest === request.requestId && session.authAction === request.action) {
        return json_(authResult_(row, session));
      }
      if (request.action === 'register' && row) fail_('ID_EXISTS', '이미 사용 중인 아이디입니다. 로그인하거나 다른 아이디를 정해 주세요.');
      if (request.action === 'login' && (!row || String(row[COL['네 자리 비밀번호']]).padStart(4, '0') !== request.pin)) fail_('BAD_CREDENTIALS', '아이디 또는 비밀번호를 확인해 주세요.');
      if (!row) {
        rowNumber = sheet.getLastRow() + 1;
        row = HEADERS.map(function () { return ''; });
        row[COL['사용자 아이디']] = request.id;
        row[COL['가입 시각']] = stamp_();
        row[COL['저장 차수']] = 0;
        row[COL['누적 플레이 초']] = 0;
        row[COL['누적 플레이 시간']] = duration_(0);
        row[COL['현재 등급']] = RANK_NAMES[0];
        row[COL['클리어 여부']] = '성장 중';
        row[COL['게임 버전']] = GAME_VERSION;
      }
      row[COL['네 자리 비밀번호']] = request.pin;
      row[COL['최근 로그인 시각']] = stamp_();
      row[COL['로그인 횟수']] = integer_(row[COL['로그인 횟수']]) + 1;
      session = { token: Utilities.getUuid() + Utilities.getUuid(), authRequest: request.requestId, authAction: request.action,
        lastRequest: session ? session.lastRequest || '' : '', lastRevision: session ? integer_(session.lastRevision) : 0,
        expires: Date.now() + 7 * 86400000 };
      writeRow_(sheet, rowNumber, row);
      putSession_(request.id, session);
      return json_(authResult_(row, session));
    }
    if (!row || !session || session.token !== request.token || session.expires < Date.now()) fail_('SESSION_CONFLICT', '다른 기기에서 로그인했거나 접속이 만료되었습니다. 다시 로그인해 주세요.');
    if (request.action === 'logout') {
      // Keep only the last committed-request marker so a lost response can be
      // reconciled on the next login; this token is immediately invalidated.
      session.token = ''; session.expires = 0; session.authRequest = ''; session.authAction = '';
      putSession_(request.id, session);
      return json_({ ok: true });
    }
    if (request.action !== 'save') fail_('INVALID_ACTION', '지원하지 않는 요청입니다.');
    var revision = integer_(row[COL['저장 차수']]);
    if (session.lastRequest === request.requestId && revision === request.revision + 1) {
      return json_({ ok: true, revision: revision, savedAt: row[COL['최근 저장 시각']], playSeconds: integer_(row[COL['누적 플레이 초']]), repeated: true });
    }
    if (!Number.isSafeInteger(request.revision) || request.revision !== revision) fail_('REVISION_CONFLICT', '서버에 더 새로운 진행이 있습니다. 다시 로그인하여 최신 진행을 불러와 주세요.');
    var state = normalize_(request.state);
    writeProgress_(row, state, request.version);
    row[COL['저장 차수']] = revision + 1;
    // Request marker precedes row commit: retry succeeds only if the row revision also advanced.
    session.lastRequest = request.requestId;
    session.lastRevision = revision + 1;
    session.expires = Date.now() + 7 * 86400000;
    putSession_(request.id, session);
    writeRow_(sheet, rowNumber, row);
    return json_({ ok: true, revision: revision + 1, savedAt: row[COL['최근 저장 시각']], playSeconds: state.stats.playSeconds });
  } catch (error) {
    return json_({ ok: false, code: error.code || 'SERVER_ERROR', message: error.code ? error.message : '저장 서버에서 오류가 발생했습니다. 운영자는 앱스 스크립트 실행 기록을 확인해 주세요.' });
  } finally { if (lock.hasLock()) lock.releaseLock(); }
}
