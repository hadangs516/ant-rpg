# 개미 키우기 RPG · 제작 및 재개 기록

## 최신 변경 · v1.0.2
- 사용자의 최신 지시가 아래 초기 요구보다 우선: 계정 없는 플레이 제거, 휴대폰 종류 선택 제거, 전체화면 전환 전면 제거. PC/모바일 선택 후 계정 로그인.
- src/main.js에서 게스트 실행/저장 및 모든 전체화면 API 호출 삭제. 과거 기종 설정은 type만 사용. 기존 게스트 백업은 삭제하지 않지만 시작 경로는 없음.
- styles.css 모바일 HUD와 dialog를 보이는 viewport에 맞춤. 로그인 키보드 화면은 높이·offsetTop 변화에 대응. 임무/사건은 접어서 화면을 확보.
- 배포: outputs/개미키우기RPG-v1.0.2-업데이트.zip은 index.html, styles.css, src/main.js, src/config.js만 포함. 전체 ZIP도 별도 제공. 구글 시트/Apps Script 재배포 불필요.
- 브라우저 회귀 검사: work/qa-ui-v102.mjs와 work/qa-account.mjs. 예전 qa-mobile/qa-smoke는 제거된 게스트 진입을 사용하므로 현재 진입 검증에는 사용하지 않는다.
- 이 폴더는 Git 저장소가 아님. 자동 커밋하지 않고 파일과 ZIP으로 전달.
- 완료 검증: 기존 단위 53개, 소스 검사, 브라우저 6개 화면 및 PIN0516·60초 자동 저장·재로그인 검사 통과. 상세는 검증결과.md. 브라우저 검사는 임시 Chrome과 모의 서버를 사용했으며 실제 휴대폰 및 운영 시트 검사는 아님.

## 확정 요구
- 정적 웹 게임, GitHub Pages 업로드 가능. 제목 개미 키우기 RPG. 버전 1.0.0.
- 약 30분 첫 클리어. 갓 태어난 일개미 → 견습 → 숙련 → 작업대장 → 여왕 후보 → 여왕. 즉위 후 종료 없이 평온한 생활.
- 굴 내부는 복잡한 측면 연결 통로, 클릭 경로 이동. 밖은 탑다운, 키보드/가상 조이스틱. 문 가까이에서 상호작용해 전환.
- 생활·채집·협동 운반·굴착 중심, 가끔 재해와 간단한 포식자 대응. 15명 주요 NPC와 다수 생활 NPC.
- PC/모바일 선택, 모바일은 기종 선택. 안드로이드는 사용자 버튼으로 전체화면 요청. iPhone은 보이는 세로 영역에 하단 정렬, 가로 여백 없음.
- 한국어 ID + 문자열 네 자리 PIN(0516 보존). 시트의 제목/열/상태/진행 내역은 한국어.
- 플레이 시간, 로그인 횟수, 퀘스트/등급/자원 등 기록. 매 60초 저장 및 설정의 즉시 저장. 가입 안내는 정확히 “진행 상황을 불러오기 위해 계정과 진행 데이터를 저장합니다”.
- 설정: 기기 변경, BGM/효과음, 저장, 로그아웃. 오른쪽 하단 현재 버전.
- 네트워크 실패 시 기기 저장, 재연결 동기화. 동시 세션 오래된 덮어쓰기 방지.
- 파비콘 SVG/ICO/PNG, Apple 180, 앱 192/512, 카카오 미리보기 800×400, 일반 공유 1200×630.
- 제공 API URL은 config.js에 지정. 실제 Apps Script 설치/재배포는 코드 및 설명서로 제공하며 성공 여부를 허위 표시하지 않음.

## 설계와 파일 소유
- index.html, styles.css, src/main.js, src/audio.js, assets, tools, README.md: 주 에이전트.
- src/world.js: 월드 에이전트. Canvas 2D, 연결 그래프 경로 이동, NPC 생활과 협동, 지도.
- src/content.js, src/progression.js, tests/progression.test.mjs: 성장 에이전트.
- src/storage.js, apps-script/Code.gs, tests/storage.test.mjs, apps-script/설치안내.md: 저장 에이전트.
- 별도 빌드 없이 상대경로 ES modules. Node 내장 test, Playwright 브라우저 검증.

## 공통 규격
상태: {version:1, rank:0, xp:0, questIndex:0, questProgress:0, completed:[], inventory:{seed:0,dew:0,crumb:0,leaf:0,berry:0}, stats:{playSeconds:0,gathered:0,dug:0,helped:0,events:0}, discoveries:[], friendships:{}, cleared:false, clearedAt:null, queen:{decor:0,tributes:0}, world:{scene:'nest',x:0,y:0,dug:0}, settings:{bgm:.35,sfx:.6}}.
RANKS: [{name,color,size,threshold}]. NPCS: [{id,name,role,personality,dialogue:[...],color,room}].
QUESTS: [{id,title,description,npc,type,target,count,xp,rank}]. target은 NPC id 또는 seed/dew/crumb/leaf/berry/dig/nursery/rest/guard/scout.
행동 type: talk,gather,deliver,dig,care,rest,recruit,scout,defend,repair,royal. applyAction은 진행/통계만 처리, 자원 획득/소비는 main이 담당.
progression.js: createState(), normalizeState(raw), getCurrentQuest(state), applyAction(state,type,target,amount=1), canCompleteQuest(state), completeQuest(state)→{ok,quest,rankUp,cleared}, getRank(state).
world.js: export class World constructor(canvas,{npcs,onNotice}={}); setState(state); setMode('nest'|'outside'); setInput(x,y); moveToScreen(x,y); update(dt); render(); nearest()→entity|null; resize(); guideTo(id); recruit(count); consume(id); dig(); setEvent(event|null); getSnapshot(); applySnapshot(data); drawMap(canvas). scene/player는 읽기 가능. entity: {id,type:'npc'|'exit'|'resource'|'station'|'dig',name,x,y,kind?}. exit id exit/entrance. resource kind seed/dew/crumb/leaf/berry. station kind nursery/rest/guard/scout/royal. guideTo는 다른 장면이면 문으로 안내.
storage.js: export class RemoteStore; constructor({onStatus}={}); register(id,pin), login(id,pin)→{state:null|object,loginCount:number}; save(state)→{ok:boolean,...}; logout(); loadLocal(id)→state|null. API/network errors descriptive. Guest local mode via local account separate from online account. Method names may be coordinated directly.

## 실행 순서 / 검증
- [x] 요구와 인터페이스 기록. 사용자의 제작 시작 지시로 구현 승인됨.
- [x] 성장 데이터와 순수 로직: 퀘스트/등급/클리어 테스트.
- [x] 월드: 실내 연결성, 실외 이동, NPC와 상호작용, 지도 검증.
- [x] 저장: PIN 0516, 등록/로그인, 60초 누적, 한국어 출력, 세션 충돌 테스트.
- [x] UI·컨트롤·소리·이미지·모바일 viewport 통합.
- [x] 실제 브라우저에서 PC/Android/iPhone 크기, 퀘스트 진행과 저장 검증.
- [x] 설치 안내, 배포 준비, ZIP, 스크린샷, 재개 기록 완성.

## 재개 방법
이 문서를 먼저 읽고 실제 파일 및 tests 결과를 확인한다. 기존 결과를 다시 만들지 않는다. package.json의 npm test로 검증하고 node tools/serve.mjs로 실행한다. 새 수정 배포마다 src/config.js VERSION과 변경 내역을 갱신한다. 온라인 연동은 Apps Script 배포 상태를 확인해야 하며 로컬 체험 성공을 온라인 성공이라고 표시하지 않는다.

## 저장 모듈 완료 기록 (저장 에이전트 · 2026-09-13)
- 완료 파일: src/storage.js, apps-script/Code.gs, apps-script/설치안내.md, tests/storage.test.mjs, tests/apps-script.test.mjs.
- API: register/login은 온라인 접속을 확립하고 {state,loginCount,recoveredLocal} 반환. saveLocal(state)는 현재 온라인 계정의 기기 백업. loadLocal(id)는 백업 상태 조회. 새로고침 뒤에는 명시적 로그인.
- save(state)는 직렬 저장/최신 대기 상태 병합, 읽을 수 있는 JSON 응답 확인, 같은 요청 표식 재시도, 누적 플레이 초 비감소, 저장 차수 충돌 및 다른 기기 로그인 차단. 실제 실패를 온라인 성공으로 표시하지 않음.
- 시트: 한국어 31열/행 교대색/필터/고정 머리글, 현재 임무 실제 제목, 한글 복원 자료, PIN 문자열/텍스트서식 적용(0516와 0000 검증), 중복 가입·로그인·저장 재시도 방지. 세션 표식은 시트가 아니라 스크립트 속성에 보관.
- 추가 합의 반영: world.followers와 world.ambientWork를 동료 수/굴착조 작업 초로 보존. clearedAt은 시트 복원 자료 안에서 숫자 시각으로 저장하고 로그인 응답에서는 원래 ISO 문자열로 복원.
- 검증: node --test --test-isolation=none tests/storage.test.mjs tests/apps-script.test.mjs → 24개 모두 통과. 실제 RemoteStore→모의 Apps Script 왕복 계약 포함.
- 실제 구글 시트 쓰기·가입 검사는 수행하지 않음. 운영자가 Code.gs를 본인 Apps Script에 설치, 시트준비 실행, 기존 웹 앱 새 버전 배포 후 GitHub Pages에서 0516 가입/저장/재로그인 확인 필요. 자세한 설명은 apps-script/설치안내.md.

## 월드와 아이콘 완료 기록 (월드 에이전트 · 2026-09-13)
- 완료 파일: src/world.js, tests/world.test.mjs, assets/colony.svg, assets/favicon.svg, assets/favicon.ico, assets/favicon-16.png, assets/favicon-32.png, assets/favicon-48.png, assets/apple-touch-icon.png, assets/icon-192.png, assets/icon-512.png.
- 실내: 15개 연결 방, 43마리 생활 개미와 15명 주요 NPC, 역할별 출근·운반·휴식 경로, 굴 밖은 정원과 14마리 채집 개미. 모든 실내 이동·길 안내·지도는 같은 연결 그래프를 사용하며 흙을 가로지르는 직선 이동을 막음.
- 사용자 굴착 5회로 버섯밭–장터 지름길이 실제 개방됨. 굴착조는 활동 시간 160초마다 공유 공사 1회 기여. 플레이어 개인 퀘스트 횟수는 stats.dug, 군락 공사는 world.dug로 구분.
- 정찰 상호작용 scout는 실외 정원 관측대(1330,690)에만 존재. 실내 관측소에는 NPC 바람이 있음. 동료 최대 수는 숙련 등급3마리, 작업대장 이상5마리.
- recruit(count)는 원하는 전체 동료 수를 확보하고 새로 더한 수를 반환. 새 동료 모집 퀘스트는 world.followers.length 전체 인원으로 판정해야 이전에 모집한 동료 때문에 진행이 막히지 않음.
- setEvent의 defend 사건은 고정 위치 포식자 상호작용(id predator, type station, kind guard)을 실외에 추가. 이벤트 progress/count로 남은 힘, 밀려남, 흙먼지 표시. setEvent(null)이 사건을 종료함. 실외 전투 길 안내는 guideTo('predator')를 사용.
- 추가 API: getEntities(), screenToWorld(x,y), moveToMap(x,y). snapshot에는 followers와 ambientWork가 포함됨. 지도는 작은 화면에서 이름을 생략하고 큰 지도는 짧은 방 이름을 사용.
- 검증: node --test --test-isolation=none tests/world.test.mjs → 11개 모두 통과. 모든 225개 방 조합 경로와 통로 내부 샘플, 지름길, 저장 복원, 자원 재생성, 정찰, 모집 인원, 포식자 상호작용 포함.
- 실제 Chrome 검증: PC1280×780와 모바일390×730에서 렌더·방 경로·정찰·비·포식자 접근 통과, 페이지 오류 없음. 모바일 크기 캐시 프레임 평균8.85ms는 데스크톱 검사 환경 수치이며 실제 휴대폰 성능 보장은 아님.
- 작업용 검증/미리보기는 프로젝트 상위 work/qa-world.mjs, work/render-ant-icons.mjs, work/world-*.png, work/colony-preview.png. 파비콘 PNG 16/32/48/180/192/512 크기 확인, ICO는16/32/48 PNG 프레임 포함. colony.svg는720×680 투명 벡터 표지.

## 성장·공유 자료 완료 기록 (성장 에이전트 · 2026-09-14)
- 성장 콘텐츠: src/content.js의6등급/15명 주요 NPC/30개 주요 임무/11개 선택 사건. 승급은 완료 임무6/12/18/24/30개, 공헌도만으로 우회 불가. 클리어 뒤에도 행동과 기록 지속.
- 진행 자료: src/progression.js에서 손상된 저장값 정리, 완료 임무 연속 순서 확인, 중복 보상 방지, world.followers와 world.ambientWork 보존. 진행 테스트11개 통과 확인.
- 공유 PNG: assets/kakao-preview.png800×400, assets/share-preview.png1200×630. 기존 colony.svg로 구성한 따뜻한 종이색·초록 제목. 최종 두 이미지를 직접 열어 한글·제목·일러스트를 확인함.
- 편집 가능한 원본: assets/kakao-source.svg, assets/share-source.svg. 작업용 생성 스크립트는 프로젝트 상위 work/render-ant-share.mjs이며 번들sharp를 사용함. 게임 배포에는 생성 스크립트가 필요하지 않음.
- tools/set-site-url.mjs는 HTTPS 게임 주소를 받아 index.html의og:image/twitter:image/og:url을 정적 절대 주소로 갱신함. 모듈 임포트만으로 파일을 수정하지 않음. 단독 검증에서 저장소 경로 유지, index.html 주소 정리, 반복 실행 안정성, 중복 메타 제거, HTTP·로그인 정보·쿼리·해시 거부 확인.
- README.md에 한글 플레이 안내, 시트 기록 범위, 기기 체험과 온라인 계정 차이, GitHub Pages 업로드, 공유 주소 설정 명령 추가. 실제 GitHub 배포 주소는 아직 제공되지 않았으므로 index.html의공유 주소는 운영자가 배포 후 도구로 설정해야 함.
- 캠페인 속도 검토: 실제 경로 그래프와 자원 위치의 최단 이동/고정 작업/짧은 대화만 계산하면 약13.2분. 첫 플레이의학습·길 찾기·NPC 대화·선택 사건을 제외한 하한값이며 실제30분 플레이 검증 결과가 아님. 지속적인 플레이 테스트에서20~30분 범위를 조정할 수 있음.

## 통합 구현 및 검증 중간 기록 (주 에이전트 · 2026-09-14)
- src/main.js, src/audio.js, styles.css, index.html, manifest.webmanifest, tools/serve.mjs, tools/check.mjs 통합 완료. 현재 버전 v1.0.1.
- 실제 Chrome의 데스크톱 가입 진입/기기 체험/첫 NPC 임무/설정 정지/즉시 저장 검사 완료.
- work/qa-smoke.mjs full → 30개 주요 임무를 모두 실제 인터랙션 컨트롤러로 완료, 승급/즉위/클리어 후 공물 받기 통과, 페이지 오류 없음. 빠른 검증을 위해 이동 위치와 가상 시계를 조작했으므로 실제 30분 플레이 측정은 아님.
- 수정: 로그인 요청 대기 중 탭/체험/닫기 잠금, 지도 입력에 물리 픽셀 대신 CSS 픽셀 적용, 재해 사건이 주요 퀘스트 행동을 가로채지 않도록 수정, 사건 버튼으로 현장 작업 선택, 포식자 반응 갱신, 왕실 잎 장식 실제 표시.
- 남은 작업: work/qa-mobile.mjs의 터치·화면·지도·저장 테스트 결과 확인; 저장 에이전트의 로컬 기록 소유권/응답 유실 복구 수정 최종 검사; 전체 단위 검사; 소스 검사; 압축 파일과 최종 안내.
- 자동 브라우저 검증은 임시 Chrome 프로필 사용. 일반 권한에서는 브라우저 spawn EPERM이 나므로 require_escalated로 node work/qa-smoke.mjs 및 node work/qa-mobile.mjs를 실행했다. 개인 Chrome 프로필 사용하지 않음.

## 최종 전달 기록 · v1.0.1
- 게임 소스·아이콘·공유 이미지·Apps Script·한글 안내 제작 완료. Node 검사53개, 소스 문법 및 필수 파일 검사, 30개 주요 임무와 여왕 이후 생활 브라우저 검사 통과.
- work/qa-mobile.mjs: iPhone390×844/844×390, Android360×740 화면 에뮬레이션에서 터치 이동·지도·저장·로그아웃 통과.
- work/qa-account.mjs: 모의 서버로 실제 브라우저 PIN0516 가입, 로그인 대기 UI 잠금,60초 자동 저장,즉시 저장,로그아웃/재로그인 복원 통과. 실제 구글 시트 쓰기는 수행하지 않음.
- 새 수정 시 이 문서와 CHANGELOG를 읽고 현재 파일에서 계속한다. 기존 기능을 처음부터 다시 만들지 않는다. 수정한 배포본은 src/config.js·package.json·index.html의표시 및 변경 기록 버전을 함께 갱신한다.
- 운영자가 할 배포 단계: Apps Script에 apps-script/Code.gs를 붙여넣고 시트준비 실행, 기존 웹 앱의 새 버전 배포. GitHub Pages에 게임 폴더 내용을 업로드. 실제 공개 주소가 생기면 tools/set-site-url.mjs로 공유 메타의절대 주소를 설정. 두 안내는 README.md 및 apps-script/설치안내.md 참조.
