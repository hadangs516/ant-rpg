import {VERSION} from './config.js';
import {RANKS,NPCS,QUESTS,EVENTS,ITEMS} from './content.js';
import {createState,normalizeState,getCurrentQuest,applyAction,canCompleteQuest,completeQuest,getRank} from './progression.js';
import {World} from './world.js';
import {RemoteStore} from './storage.js';
import {Sound} from './audio.js';

const $=id=>document.getElementById(id);
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=name=>'<svg aria-hidden="true"><use href="#i-'+name+'"/></svg>';
const readLocal=key=>{try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}};
const writeLocal=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}};
const timeText=s=>Math.floor(s/60)+'분 '+Math.floor(s%60)+'초';
const sound=new Sound();
const modal=$('modal');
let state=createState(),world=null,active=false,guest=false,userId='',device=readLocal('ant-rpg:device')||null;
let work=null,currentEvent=null,eventWait=80,lastEvent='',autosaveElapsed=0,localElapsed=0,lastFrame=performance.now(),hudElapsed=0;
let guideTarget=null,authMode='login',authPending=false,forcedLogin=false,stickId=null,stick={x:0,y:0},keys=new Set(),lastNearby=null,lastInteraction=0;
const store=new RemoteStore({onStatus:showSaveStatus});
$('version').textContent='v'+VERSION;
const itemPictures={
seed:'<ellipse cx="12" cy="12" rx="6" ry="9" fill="#d2b275" stroke="#a78d59" transform="rotate(35 12 12)"/><path d="m9 17 6-10" stroke="#a58a53"/>',
dew:'<path d="M12 2C10 7 5 11 5 15a7 7 0 0 0 14 0c0-4-5-8-7-13Z" fill="#91bdc4" stroke="#749da5"/><path d="M8 14c-1 3 1 4 3 4" stroke="#e6f8ee"/>',
crumb:'<path d="m5 4 7-2 7 3 2 8-3 8-10 1-6-8Z" fill="#cea263" stroke="#ab824d"/><circle cx="8" cy="10" r="1.4" fill="#927341"/><circle cx="15" cy="15" r="2" fill="#ac8045"/><circle cx="15" cy="7" r="1.4" fill="#ac8045"/>',
leaf:'<path d="M21 2C7 1 1 8 5 17c7 6 15 0 16-15Z" fill="#91ac69" stroke="#759352"/><path d="m3 22 13-15M10 15l-2-5m5 2 5 1" stroke="#668748"/>',
berry:'<path d="M5 8q7-5 14 0c4 6-3 14-7 14S1 14 5 8Z" fill="#b87576" stroke="#9f6269"/><path d="m5 6 5 2 2-6 2 6 5-2" fill="#809457" stroke="#809457"/><path d="m8 12 1 1m6-1 1 1m-4 4 1 1" stroke="#f1d5a7"/>'
};
const itemHTML=key=>'<span class="item-sprite"><svg viewBox="0 0 24 24" aria-hidden="true">'+itemPictures[key]+'</svg></span>';
$('inventory-strip').innerHTML=Object.keys(ITEMS).map(k=>'<div class="inventory-item" title="'+ITEMS[k].name+'">'+itemHTML(k)+'<b id="item-'+k+'">0</b></div>').join('');

function toast(text,warn=false){
  const el=document.createElement('div');el.className='toast'+(warn?' warn':'');el.textContent=text;$('toast-area').append(el);
  while($('toast-area').children.length>3)$('toast-area').firstChild.remove();
  setTimeout(()=>el.remove(),4200);
}
function showSaveStatus({kind,message}){$('save-indicator').dataset.kind=kind;$('save-label').textContent=message;}
function showModal(eyebrow,html,{locked=false}={}){
  stopMovement();cancelWork(false);$('modal-eyebrow').textContent=eyebrow;$('modal-content').innerHTML=html;$('modal-close').hidden=locked;
  if(!modal.open)modal.showModal();sound.play('click');
}
function closeModal(){if(forcedLogin||authPending)return;modal.close();lastFrame=performance.now();}
$('modal-close').onclick=closeModal;
modal.addEventListener('cancel',e=>{if(forcedLogin||authPending)e.preventDefault();});
modal.addEventListener('close',()=>{lastFrame=performance.now();});
function stopMovement(){keys.clear();stick={x:0,y:0};stickId=null;$('stick-knob').style.transform='';world?.setInput(0,0);}
function syncDevice(){
  const mobile=device?.type==='mobile',ios=mobile&&device.os==='ios';
  document.body.classList.toggle('mobile',mobile);document.body.classList.toggle('ios',ios);
  const h=Math.floor(Math.min(window.innerHeight,window.visualViewport?.height||window.innerHeight));
  document.documentElement.style.setProperty('--visible-height',h+'px');world?.resize();
  if(mobile)$('quest-card').classList.add('collapsed');
}
window.addEventListener('resize',syncDevice);
window.visualViewport?.addEventListener('resize',syncDevice);
function deviceDialog(returnToSettings=false){
  showModal('나에게 맞는 화면','<h2>어디에서 플레이할까요?</h2><p>기기에 맞춰 화면과 조작을 준비할게요.<br>설정에서 언제든 바꿀 수 있어요.</p><div class="device-options"><button id="choose-pc" class="device-option"><svg viewBox="0 0 40 40"><rect x="3" y="5" width="34" height="23" rx="3"/><path d="M20 28v7m-9 0h18"/></svg>PC로 플레이<small>마우스 · 키보드</small></button><button id="choose-mobile" class="device-option"><svg viewBox="0 0 40 40"><rect x="10" y="2" width="20" height="36" rx="4"/><path d="M17 6h6m-5 27h4"/></svg>모바일로 플레이<small>터치 · 조이스틱</small></button></div>');
  const done=()=>{writeLocal('ant-rpg:device',device);syncDevice();returnToSettings?settingsDialog():authDialog();};
  $('choose-pc').onclick=()=>{device={type:'pc',os:'pc',model:'컴퓨터'};if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});done();};
  $('choose-mobile').onclick=()=>{
    showModal('휴대폰에 맞게 준비하기','<h2>휴대폰을 골라 주세요</h2><p>기종과 화면 크기에 맞춰 조작 버튼을 배치해요.</p><div class="form-row"><label for="phone-os">휴대폰 종류</label><select id="phone-os"><option value="android">안드로이드</option><option value="ios">아이폰</option></select></div><div class="form-row"><label for="phone-model">사용하는 기종</label><select id="phone-model"></select></div><p id="phone-hint"></p><button id="device-done" class="primary full">이 화면으로 시작</button>');
    const models={android:['갤럭시 S 시리즈','갤럭시 A 시리즈','갤럭시 Z 플립','갤럭시 Z 폴드','갤럭시 노트','구글 픽셀','기타 안드로이드'],ios:['아이폰 16 / 16 프로','아이폰 16 플러스 / 프로 맥스','아이폰 15 / 15 프로','아이폰 15 플러스 / 프로 맥스','아이폰 14 / 14 프로','아이폰 13 / 12','아이폰 미니 / SE','기타 아이폰']};
    $('phone-os').value=/iPhone|iPad|iPod/.test(navigator.userAgent)?'ios':device?.os==='ios'?'ios':'android';
    const choices=()=>{const os=$('phone-os').value;$('phone-model').innerHTML=models[os].map(x=>'<option>'+x+'</option>').join('');$('phone-hint').textContent=os==='ios'?'주소창 아래의 보이는 영역에 맞춰, 가로 폭은 그대로 사용해요.':'시작 버튼을 누르면 지원되는 브라우저에서 전체화면으로 전환해요.';};
    $('phone-os').onchange=choices;choices();
    $('device-done').onclick=()=>{device={type:'mobile',os:$('phone-os').value,model:$('phone-model').value};if(device.os==='android'&&document.documentElement.requestFullscreen){document.documentElement.requestFullscreen().catch(()=>{if(active)toast('전체화면이 제한된 브라우저예요. 현재 화면에 맞춰 플레이해요.');});}else if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});done();};
  };
}
function authDialog(message=''){
  const signup=authMode==='register';
  showModal('작은 숲의 식구가 되어 주세요','<h2>'+(signup?'처음 만나는 우리 군락':'다시 만나서 반가워요')+'</h2><div class="auth-tabs"><button id="tab-login" class="'+(!signup?'active':'')+'">로그인</button><button id="tab-register" class="'+(signup?'active':'')+'">처음 왔어요</button></div><form id="auth-form"><div class="form-row"><label for="user-id">사용자 아이디</label><input id="user-id" name="username" autocomplete="username" maxlength="12" placeholder="한글 두 글자부터 열두 글자" value="'+escapeHTML(userId||'')+'" required><small>한글만 사용할 수 있어요. 예: 풀잎개미</small></div><div class="form-row"><label for="user-pin">네 자리 PIN</label><input id="user-pin" name="password" type="password" inputmode="numeric" autocomplete="'+(signup?'new-password':'current-password')+'" pattern="[0-9]{4}" minlength="4" maxlength="4" placeholder="숫자 네 자리" required></div><p id="auth-error" class="form-error" '+(!message?'hidden':'')+'>'+escapeHTML(message)+'</p><button id="auth-submit" class="primary full" type="submit">'+(signup?'새 식구로 시작하기':'이어서 플레이하기')+'</button></form><p class="form-note">진행 상황을 불러오기 위해 계정과 진행 데이터를 저장합니다</p>'+(!forcedLogin?'<div class="divider">기기에서 먼저 만나보기</div><button id="guest-start" class="text-button full">계정 없이 이 기기에서 플레이</button><p class="form-note">기기 체험은 이 브라우저에 저장돼요.<br>다른 기기와 이어 하려면 계정으로 시작해 주세요.</p>':'<button id="conflict-exit" class="text-button full">시작 화면으로 돌아가기</button>'),{locked:forcedLogin});
  $('tab-login').onclick=()=>{authMode='login';authDialog();};$('tab-register').onclick=()=>{authMode='register';authDialog();};
  $('auth-form').onsubmit=async e=>{
    e.preventDefault();const id=$('user-id').value.trim(),pin=$('user-pin').value;
    if(!/^[가-힣]{2,12}$/.test(id)||!/^\d{4}$/.test(pin)){showAuthError('아이디는 한글 2~12자, PIN은 숫자 네 자리로 입력해 주세요.');return;}
    authPending=true;for(const id of ['tab-login','tab-register','guest-start','conflict-exit'])if($(id))$(id).disabled=true;$('modal-close').hidden=true;const button=$('auth-submit');button.disabled=true;button.textContent='군락의 기록을 확인하고 있어요…';$('auth-error').hidden=true;
    try{const result=await store[authMode](id,pin);forcedLogin=false;startGame(id,result.state,false);if(result.recoveredLocal)toast('기기에 남은 진행을 이어서 불러왔어요.');}
    catch(error){if(modal.open&&$('auth-error'))showAuthError(error.message);}
    finally{authPending=false;for(const id of ['tab-login','tab-register','guest-start','conflict-exit'])if($(id))$(id).disabled=false;$('modal-close').hidden=forcedLogin;if($('auth-submit')){$('auth-submit').disabled=false;$('auth-submit').textContent=signup?'새 식구로 시작하기':'이어서 플레이하기';}}
  };
  if($('guest-start'))$('guest-start').onclick=()=>{const backup=readLocal('ant-rpg:guest');const typed=$('user-id').value.trim();startGame(/^[가-힣]{2,12}$/.test(typed)?typed:backup?.id||'풀잎개미',backup?.state,true);};
  if($('conflict-exit'))$('conflict-exit').onclick=()=>{forcedLogin=false;endGame(false);};
}
function showAuthError(text){$('auth-error').textContent=text;$('auth-error').hidden=false;}
function startGame(id,raw,isGuest){
  active=false;state=raw?normalizeState(raw):createState();guest=isGuest;userId=id;
  $('welcome').hidden=true;$('game').hidden=false;modal.close();
  world=new World($('world'),{npcs:NPCS,onNotice:message=>toast(message)});world.setState(state);world.applySnapshot(state.world);
  sound.unlock();sound.setVolumes(state.settings.bgm,state.settings.sfx);
  currentEvent=null;eventWait=75;lastEvent='';autosaveElapsed=0;localElapsed=0;guideTarget=null;work=null;
  $('event-banner').hidden=true;syncDevice();active=true;lastFrame=performance.now();updateHUD();backupLocal();
  showSaveStatus({kind:guest?'offline':'saved',message:guest?'기기 체험 · 이 브라우저에 저장':'진행 상황을 불러왔어요'});
  if(state.cleared){world.recruit(5);toast('여왕님, 오늘은 어떤 산책을 해 볼까요?');}
  else if(state.questIndex===0){toast('선배 봄이가 기다려요. 가까이 가서 인사해 보세요.');world.guideTo('봄이');}
  else toast('반가워요. 지난 발걸음에서 이어가요.');
}
function snapshot(){if(world)state.world=world.getSnapshot();return state;}
function backupLocal(){
  if(!active)return false;snapshot();
  const ok=guest?writeLocal('ant-rpg:guest',{id:userId,state}):store.saveLocal(state);
  if(!ok)showSaveStatus({kind:'error',message:'기기 저장 공간을 확인해 주세요'});
  return ok;
}
async function saveGame(manual=false){
  if(!active)return {ok:false};snapshot();let result;
  if(guest){result={ok:backupLocal()};showSaveStatus({kind:result.ok?'saved':'error',message:result.ok?'기기 체험 · 저장 완료':'기기 저장에 실패했어요'});}
  else{result=await store.save(state);if(['SESSION_CONFLICT','REVISION_CONFLICT','INVALID_SESSION','SESSION_EXPIRED'].includes(result.code)){active=false;stopMovement();forcedLogin=true;authMode='login';authDialog(result.message||'다른 곳에서 계정이 사용됐어요. 다시 로그인해 주세요.');}}
  if(manual&&active)toast(result.ok?(guest?'이 기기에 현재 진행을 저장했어요.':'군락의 기록을 안전하게 저장했어요.'):'연결을 확인해 주세요. 진행은 기기에 임시 보관했어요.',!result.ok);
  return result;
}
async function endGame(save=true){
  if(save&&active)await saveGame(false);backupLocal();active=false;work=null;currentEvent=null;world?.setEvent(null);stopMovement();store.logout();modal.close();$('game').hidden=true;$('welcome').hidden=false;$('toast-area').innerHTML='';sound.suspend();forcedLogin=false;
}
function updateHUD(){
  if(!world)return;const q=getCurrentQuest(state),ready=canCompleteQuest(state);world.setState(state);
  $('player-name').textContent=userId;$('player-rank').textContent=getRank(state).name;
  $('place-name').textContent=world.scene==='nest'?'작은 숲 · 개미굴':'작은 숲 · 햇살 정원';
  $('day-label').textContent=['햇살이 머무는 아침','느긋한 숲의 오후','노을이 번지는 시간','별빛 아래의 군락'][Math.floor(state.stats.playSeconds/240)%4];
  $('quest-number').textContent=q?String(state.questIndex+1).padStart(2,'0')+' / '+QUESTS.length:'CLEAR';
  $('quest-title').textContent=q?q.title:'여왕의 평범하고 특별한 하루';
  $('quest-description').textContent=q?(ready?q.npc+'에게 돌아가 이야기를 마무리하세요.':q.description):'왕실에서 공물을 받고, 방을 꾸미고, 동료들과 산책하세요. 오늘은 쉬어도 좋아요.';
  $('quest-count').textContent=q?state.questProgress+' / '+q.count:'여유롭게';
  $('quest-fill').style.width=q?Math.min(100,state.questProgress/q.count*100)+'%':'100%';
  $('quest-owner').textContent=q?q.npc+'의 부탁':'우리의 여왕, '+userId;
  for(const key of Object.keys(ITEMS))$('item-'+key).textContent=state.inventory[key];
  $('joystick').hidden=world.scene!=='outside';$('home-button').hidden=world.scene!=='outside';
  if(currentEvent){$('event-banner').hidden=false;$('event-name').textContent=currentEvent.name;$('event-description').textContent=currentEvent.description;$('event-count').textContent=currentEvent.progress+' / '+currentEvent.count+' · '+Math.ceil(currentEvent.remaining)+'초';$('event-guide').textContent=world.nearest()?.kind===currentEvent.target&&['repair','defend','care','dig','scout'].includes(currentEvent.type)?'함께 작업하기':'현장으로 안내';}
}
function guideQuest(){
  const q=getCurrentQuest(state);
  if(!q){guideTarget='royal';}
  else guideTarget=canCompleteQuest(state)||q.type==='deliver'?q.npc:q.target;
  if(!world.guideTo(guideTarget)){toast('먹이가 다시 나타날 때까지 다른 군락 일을 해도 좋아요.');return;}
  toast(world.scene==='nest'?'페로몬 길을 따라 이동해요.':'반짝이는 길이 목적지 방향을 알려줘요.');
}
function recordAction(type,target,count=1){
  const before=canCompleteQuest(state);applyAction(state,type,target,count);
  if(currentEvent&&currentEvent.type===type&&currentEvent.target===target){currentEvent.progress=Math.min(currentEvent.count,currentEvent.progress+count);world.setEvent(currentEvent);if(currentEvent.progress>=currentEvent.count)finishEvent(true);}
  if(!before&&canCompleteQuest(state)){sound.play('reward');toast(getCurrentQuest(state).npc+'에게 돌아가면 임무를 마칠 수 있어요.');}
  updateHUD();backupLocal();
}
function cancelWork(notify=true){if(work){work=null;$('work-progress').hidden=true;if(notify)toast('작업을 멈췄어요. 다시 시작할 수 있어요.');}}
function doWork(label,seconds,done){
  if(!active||work)return;modal.close();stopMovement();world.path=[];work={label,duration:seconds,elapsed:0,done,scene:world.scene};$('work-progress').hidden=false;$('work-progress').querySelector('span').textContent=label;$('work-progress').querySelector('i').style.width='0%';sound.play('work');
}
function finishQuest(){
  const result=completeQuest(state);if(!result.ok)return;
  closeModal();sound.play(result.rankUp?'rank':'reward');world.setState(state);backupLocal();updateHUD();
  if(result.cleared){world.recruit(5);showClear();saveGame(false);}
  else if(result.rankUp){const rank=getRank(state);showModal('또 한 걸음, 성장했어요','<svg class="clear-crown"><use href="#i-leaf"/></svg><div class="clear-title"><h2>'+rank.name+'</h2><p>'+escapeHTML(rank.perk)+'</p></div><div class="clear-detail">작은 일을 함께해 온 동료들이<br>당신의 새로운 시작을 응원해요.</div><button id="rank-continue" class="primary full">새로운 하루로</button>');$('rank-continue').onclick=()=>{closeModal();guideQuest();};}
  else{toast('임무 완료 · 공헌도 +'+result.quest.xp);if(device?.type==='mobile')$('quest-card').classList.remove('collapsed');}
}
function npcDialog(entity){
  const npc=NPCS.find(n=>n.id===entity.id);if(!npc)return;
  recordAction('talk',npc.id);
  const q=getCurrentQuest(state),owns=q?.npc===npc.id,ready=owns&&canCompleteQuest(state);
  let buttons='';
  if(ready)buttons+='<button id="claim-quest" class="primary">이야기 마무리 · 공헌도 +'+q.xp+'</button>';
  else if(owns&&q.type==='deliver')buttons+='<button id="deliver-items" class="primary">'+ITEMS[q.target].name+' 전달하기 ('+state.inventory[q.target]+'개 보유)</button>';
  else if(owns&&q.type==='recruit')buttons+='<button id="recruit-party" class="primary">동료 '+q.count+'마리와 작업대 꾸리기</button>';
  else if(owns)buttons+='<button id="npc-guide" class="secondary">부탁을 하러 가기 '+icon('arrow')+'</button>';
  if(npc.id==='두리'&&state.rank>=2&&!(owns&&q.type==='recruit'))buttons+='<button id="recruit-party" class="secondary">동료들과 함께 다니기</button>';
  if(npc.id==='은빛'&&state.cleared)buttons+='<button id="queen-menu" class="secondary">여왕의 일상 즐기기</button>';
  buttons+='<button id="dialogue-close" class="text-button">다시 이야기하자</button>';
  const idx=state.cleared?2:state.rank>=2?1:0;
  showModal(npc.role,'<img class="dialogue-portrait" src="./assets/favicon.svg" alt=""><h2>'+npc.name+'</h2><span class="npc-role">'+escapeHTML(npc.personality)+'</span><p class="dialogue-text">“'+escapeHTML(npc.dialogue[idx])+'”</p>'+(owns?'<div class="dialogue-reward">'+escapeHTML(q.title)+' · '+state.questProgress+' / '+q.count+'</div>':'')+'<div class="dialogue-actions">'+buttons+'</div>');
  if($('claim-quest'))$('claim-quest').onclick=finishQuest;
  if($('npc-guide'))$('npc-guide').onclick=()=>{closeModal();guideQuest();};
  if($('deliver-items'))$('deliver-items').onclick=()=>{const n=Math.min(state.inventory[q.target],q.count-state.questProgress);if(!n){toast('아직 전달할 먹이가 없어요. 바깥에서 모아 보세요.',true);return;}state.inventory[q.target]-=n;recordAction('deliver',q.target,n);sound.play('reward');npcDialog(entity);};
  if($('recruit-party'))$('recruit-party').onclick=()=>{world.recruit(state.rank>=3?5:state.rank>=2?3:2);recordAction('recruit','두리',world.followers.length);toast(world.followers.length+'마리의 동료가 함께 걸어요.');npcDialog(entity);};
  if($('queen-menu'))$('queen-menu').onclick=queenDialog;
  $('dialogue-close').onclick=closeModal;
}
function stationAction(entity,chosenType){
  if(entity.kind==='royal'){if(state.cleared){queenDialog();return;}if(getCurrentQuest(state)?.type!=='royal'){toast('은빛 여왕이 군락의 이야기를 듣고 있어요.');return;}doWork('모두의 축하 속에, 여왕의 자리로',5,()=>{recordAction('royal','royal');finishQuest();});return;}
  const q=getCurrentQuest(state);
  const type=chosenType||(entity.type==='dig'?'dig':entity.kind==='nursery'?'care':entity.kind==='rest'?'rest':entity.kind==='scout'?'scout':entity.id==='predator'?'defend':q?.target==='guard'&&!canCompleteQuest(state)?q.type:currentEvent?.target==='guard'?currentEvent.type:'defend');
  const target=entity.type==='dig'?'dig':entity.kind;
  const labels={dig:'흙을 다지고, 새 길을 넓히는 중',care:'작은 알의 이불을 정리하는 중',rest:'풀잎 노래를 들으며 쉬는 중',scout:'바람과 발자국을 살펴보는 중',defend:entity.id==='predator'?'동료들과 힘을 모아 밀어내는 중':'동료들과 방어 대형을 맞추는 중',repair:'잎과 흙으로 빗물을 막는 중'};
  doWork(labels[type]||'군락을 돕는 중',type==='rest'?3.5:type==='scout'?3:2.8,()=>{if(type==='dig')world.dig();if(type==='defend')world.burst?.(entity.x,entity.y,'#dfcd8c',14);recordAction(type,target);sound.play('work');});
}
function interact(){
  if(!active||modal.open||work||performance.now()-lastInteraction<220)return;lastInteraction=performance.now();
  const entity=world.nearest();if(!entity)return;
  if(entity.type==='npc'){npcDialog(entity);return;}
  if(entity.type==='exit'){world.setMode(world.scene==='nest'?'outside':'nest');sound.play('click');if(guideTarget)world.guideTo(guideTarget);updateHUD();backupLocal();return;}
  if(entity.type==='resource'){
    const heavy=ITEMS[entity.kind].weight>1,need=entity.kind==='berry'?3:2;
    if(heavy&&world.followers.length<need){toast('큰 먹이는 동료 '+need+'마리와 함께 들어요. 만남의 광장에서 두리를 만나 보세요.',true);return;}
    doWork(heavy?'함께 하나, 둘! 먹이를 옮기는 중':ITEMS[entity.kind].name+' 모으는 중',heavy?4:2.2,()=>{if(world.consume(entity.id)){state.inventory[entity.kind]++;recordAction('gather',entity.kind);sound.play('reward');toast(ITEMS[entity.kind].name+' +1');}});
    return;
  }
  stationAction(entity);
}
function queenDialog(){
  showModal('왕관 너머의 평범한 하루','<h2>오늘은 무엇을 할까요?</h2><p>일을 쉬어도 괜찮아요. 이곳은 언제나 당신의 집이에요.</p><div class="clear-detail">받은 공물 <b>'+state.queen.tributes+'번</b> · 왕실 장식 <b>'+state.queen.decor+'개</b><br>오늘도 식구들이 부지런히 살아가고 있어요.</div><div class="dialogue-actions"><button id="royal-tribute" class="primary">시종의 작은 공물 받기</button><button id="royal-decor" class="secondary">왕실에 잎 장식 달기 · 잎 3개</button><button id="royal-walk" class="secondary">호위와 정원 산책하기</button><button id="royal-work" class="secondary">오늘의 공동 작업 정하기</button><button id="royal-rest" class="text-button">오늘은 느긋하게 쉬기</button></div>');
  $('royal-tribute').onclick=()=>{closeModal();doWork('시종들이 오늘의 먹이를 가져와요',3,()=>{state.queen.tributes++;state.inventory.seed+=3;state.inventory.berry++;recordAction('royal','royal');toast('씨앗 3개와 산딸기 1개를 받았어요.');sound.play('reward');});};
  $('royal-decor').onclick=()=>{if(state.inventory.leaf<3){toast('잎 조각 3개가 필요해요. 정원에서 모아 보세요.',true);return;}state.inventory.leaf-=3;state.queen.decor++;world.nestCache=null;recordAction('royal','royal');toast('왕실에 초록 장식을 더했어요.');closeModal();};
  $('royal-walk').onclick=()=>{world.recruit(5);closeModal();guideTarget='scout';world.guideTo('scout');toast('다섯 동료가 여왕님의 산책을 함께해요.');};
  $('royal-work').onclick=()=>{closeModal();if(currentEvent)toast('지금 진행 중인 공동 작업부터 함께해요.');else beginEvent(EVENTS.find(e=>e.type==='gather'&&e.target==='seed'));};
  $('royal-rest').onclick=()=>{closeModal();guideTarget='rest';world.guideTo('rest');};
}
function showClear(){
  sound.play('clear');world.burst?.(world.player.x,world.player.y,'#f0ce79',50);
  showModal('작은 발걸음이 모여, 우리의 여왕으로','<svg class="clear-crown"><use href="#i-crown"/></svg><div class="clear-title"><p>개미 키우기 RPG · 클리어</p><h2>'+escapeHTML(userId)+' 여왕님,<br>즉위를 축하해요.</h2><p>왕관보다 빛나는 건<br>함께 걸어온 동료들의 마음이에요.</p></div><div class="clear-detail">함께 마친 이야기 <b>'+state.completed.length+'개</b><br>도와준 작은 일 <b>'+Math.floor(state.stats.helped)+'번</b><br>군락에서 보낸 시간 <b>'+timeText(state.stats.playSeconds)+'</b></div><div class="clear-actions"><button id="clear-continue" class="primary full">여왕의 일상으로 계속하기</button></div>');
  $('clear-continue').onclick=()=>{closeModal();eventWait=120;toast('이야기는 클리어했지만, 우리의 일상은 계속돼요.');};
}
function beginEvent(event){
  if(!event)return;currentEvent={...event,progress:0,remaining:event.duration};lastEvent=event.id;world.setEvent(currentEvent);sound.play('event');toast(event.name+' · 작은 사건이 생겼어요.');updateHUD();
}
function finishEvent(success){
  if(!currentEvent)return;
  if(success){state.stats.events++;state.xp+=currentEvent.reward;if(!state.discoveries.includes(currentEvent.name))state.discoveries.push(currentEvent.name);toast('함께 해결했어요! 공헌도 +'+currentEvent.reward);sound.play('reward');}
  else toast('다른 동료들이 일을 마무리했어요. 다음에 함께해요.');
  currentEvent=null;world.setEvent(null);$('event-banner').hidden=true;eventWait=85+Math.random()*35;backupLocal();
}
function tickEvents(dt){
  if(currentEvent){currentEvent.remaining-=dt;if(currentEvent.remaining<=0)finishEvent(false);}
  else{eventWait-=dt;if(eventWait<=0){const pool=EVENTS.filter(e=>(e.minRank||0)<=state.rank&&(!e.queenOnly||state.cleared)&&e.id!==lastEvent&&(!state.cleared||!['defend','repair'].includes(e.type)));beginEvent(pool[Math.floor(Math.random()*pool.length)]);}}
}
function settingsDialog(){
  showModal('나의 작은 숲 설정','<h2>편안하게 머물러요</h2><div class="setting-row"><label for="bgm-volume">배경 음악 <span id="bgm-value">'+Math.round(state.settings.bgm*100)+'%</span></label><input id="bgm-volume" type="range" min="0" max="100" value="'+Math.round(state.settings.bgm*100)+'"></div><div class="setting-row"><label for="sfx-volume">효과음 <span id="sfx-value">'+Math.round(state.settings.sfx*100)+'%</span></label><input id="sfx-volume" type="range" min="0" max="100" value="'+Math.round(state.settings.sfx*100)+'"></div><div class="settings-buttons"><button id="save-now" class="primary">'+icon('save')+' 지금 저장</button><button id="change-device" class="secondary">기기 변경</button><button id="controls-help" class="secondary">조작 도움말</button><button id="logout" class="secondary">저장하고 로그아웃</button></div><p class="form-note">'+(guest?'기기 체험 중 · 이 브라우저에만 저장됩니다.':'계정으로 로그인 중 · 1분마다 자동 저장됩니다.')+'</p><div class="setting-meta"><span>'+escapeHTML(device?.model||'컴퓨터')+'</span><span>v'+VERSION+'</span></div>');
  for(const key of ['bgm','sfx'])$(key+'-volume').oninput=()=>{state.settings[key]=Number($(key+'-volume').value)/100;$(key+'-value').textContent=Math.round(state.settings[key]*100)+'%';sound.setVolumes(state.settings.bgm,state.settings.sfx);if(key==='sfx')sound.play('click');backupLocal();};
  $('save-now').onclick=async()=>{const button=$('save-now');button.disabled=true;button.textContent='저장 중…';const result=await saveGame(true);if(button.isConnected){button.disabled=false;button.innerHTML=icon('save')+(result.ok?' 저장 완료':' 다시 저장');}};
  $('change-device').onclick=()=>deviceDialog(true);$('logout').onclick=()=>endGame(true);$('controls-help').onclick=helpDialog;
}
function helpDialog(){
  showModal('길을 잃어도 괜찮아요','<h2>작은 숲 생활 안내</h2><div class="clear-detail"><b>굴 안</b> · 가고 싶은 바닥을 누르면 통로를 따라 이동해요.<br><b>바깥</b> · PC는 WASD 또는 방향키, 모바일은 왼쪽 조이스틱으로 이동해요.<br><b>상호작용</b> · 대상 가까이에서 E 또는 오른쪽 아래 버튼을 눌러요.<br><b>문</b> · 입구에 다가가 상호작용하면 안팎을 오갈 수 있어요.<br><b>임무</b> · 일을 마친 뒤 부탁한 개미에게 돌아가 보상을 받아요.<br><b>큰 먹이</b> · 숙련 등급부터 두리에게 동료를 부탁해요.<br><b>지도</b> · M 또는 위쪽 지도 버튼. 길 안내는 목적지로 이어져요.<br><b>잠시 멈추기</b> · 설정을 열면 작업과 사건이 잠시 멈춰요.</div><button id="help-done" class="primary full">알겠어요</button>');
  $('help-done').onclick=closeModal;
}
function mapDialog(){
  showModal('지금 우리가 있는 곳','<h2>'+(world.scene==='nest'?'땅 아래 이어진 우리 집':'햇살 정원의 작은 길')+'</h2><canvas id="map-canvas" class="map-canvas" width="800" height="540" aria-label="현재 위치와 목적지 지도"></canvas><div class="map-legend"><span>● 나의 위치</span><span>◇ 방과 먹이</span><span>선 · 이어진 통로</span></div><button id="map-guide" class="primary full">현재 임무 길 안내</button><p class="form-note">굴 안에서는 지도에서 방을 눌러 이동할 수 있어요.<br>바깥에서는 지도를 닫고 조이스틱이나 키보드로 이동해요.</p>');
  requestAnimationFrame(()=>{if($('map-canvas'))world.drawMap($('map-canvas'));});
  $('map-guide').onclick=()=>{closeModal();guideQuest();};
  $('map-canvas').onclick=e=>{if(world.scene!=='nest')return;const canvas=e.currentTarget,r=canvas.getBoundingClientRect();world.moveToMap?.(e.clientX-r.left,e.clientY-r.top);closeModal();};
}
function journalDialog(tab='friends'){
  const tabs='<div class="journal-tabs"><button data-journal="friends" class="'+(tab==='friends'?'active':'')+'">동료</button><button data-journal="discoveries" class="'+(tab==='discoveries'?'active':'')+'">발견</button><button data-journal="story" class="'+(tab==='story'?'active':'')+'">발걸음</button></div>';
  let cards;
  if(tab==='friends')cards=NPCS.map(n=>'<div class="journal-card '+(state.friendships[n.id]?'':'locked')+'"><b>'+n.name+'</b><small>'+n.role+'</small><small>'+(state.friendships[n.id]?escapeHTML(n.personality):'아직 인사를 나누지 않았어요')+'</small></div>').join('');
  else if(tab==='discoveries')cards=state.discoveries.length?state.discoveries.map(d=>'<div class="journal-card"><b>'+escapeHTML(d)+'</b><small>우리 군락의 기록장에 남겼어요.</small></div>').join(''):'<p>아직 기록장이 비어 있어요. 숲에서 첫 발견을 해 보세요.</p>';
  else cards=RANKS.map((r,i)=>'<div class="journal-card '+(state.rank>=i?'':'locked')+'"><b>'+r.name+'</b><small>'+r.title+'</small><small>'+(state.rank>=i?'함께 걸어온 발걸음':'앞으로 만나게 될 나')+'</small></div>').join('');
  showModal('소중한 것들을 하나씩','<h2>작은 숲 기록장</h2>'+tabs+'<div class="journal-list">'+cards+'</div><p class="form-note">마친 이야기 '+state.completed.length+' / '+QUESTS.length+' · 군락 공헌도 '+state.xp+'</p>');
  document.querySelectorAll('[data-journal]').forEach(b=>b.onclick=()=>journalDialog(b.dataset.journal));
}
function updateNearby(){
  if(!world)return;const near=world.nearest();lastNearby=near;
  $('interact-button').disabled=!near||!!work;
  $('interact-button').querySelector('span').textContent=work?'작업 중…':!near?'가까이 이동':near.type==='npc'?'이야기 나누기':near.type==='exit'?near.name:near.type==='resource'?'먹이 모으기':near.name;
  $('nearby-label').hidden=!near||!!work;
  if(near)$('nearby-label').textContent=near.type==='npc'?near.name+' · '+near.role:near.name;
}
function frame(now){
  const elapsed=Math.min(1,Math.max(0,(now-lastFrame)/1000));lastFrame=now;
  if(active&&world&&!document.hidden){
    const playing=!modal.open;
    if(playing){
      state.stats.playSeconds+=elapsed;autosaveElapsed+=elapsed;localElapsed+=elapsed;tickEvents(elapsed);
      if(work){world.setInput(0,0);world.path=[];work.elapsed+=elapsed;$('work-progress').querySelector('i').style.width=Math.min(100,work.elapsed/work.duration*100)+'%';if(work.elapsed>=work.duration){const done=work.done;work=null;$('work-progress').hidden=true;done();}}
      else{const x=stick.x+(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),y=stick.y+(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);world.setInput(x,y);}
      world.update(Math.min(elapsed,.06));sound.tick(elapsed,true);
      if(localElapsed>=10){localElapsed=0;backupLocal();}
      if(autosaveElapsed>=60){autosaveElapsed%=60;saveGame(false);}
    }
    world.render();hudElapsed+=elapsed;if(hudElapsed>.15){hudElapsed=0;updateNearby();updateHUD();}
  }
  requestAnimationFrame(frame);
}
$('start-button').onclick=()=>{sound.unlock();deviceDialog();};
$('interact-button').onclick=interact;$('quest-guide').onclick=guideQuest;
$('quest-toggle').onclick=()=>{$('quest-card').classList.toggle('collapsed');};
$('map-button').onclick=mapDialog;$('journal-button').onclick=()=>journalDialog();$('settings-button').onclick=settingsDialog;
$('home-button').onclick=()=>{guideTarget='entrance';world.guideTo('entrance');toast('집으로 이어지는 페로몬 길을 켰어요.');};
$('event-guide').onclick=()=>{if(!currentEvent||work||modal.open)return;const near=world.nearest();if(near?.kind===currentEvent.target&&['station','dig'].includes(near.type)){stationAction(near,currentEvent.type);return;}guideTarget=currentEvent.type==='defend'?'predator':currentEvent.target;world.guideTo(guideTarget);toast('함께 일할 곳으로 길을 안내해요.');};
$('world').addEventListener('pointerdown',e=>{if(!active||modal.open)return;cancelWork();const r=e.currentTarget.getBoundingClientRect();world.moveToScreen(e.clientX-r.left,e.clientY-r.top);});
window.addEventListener('keydown',e=>{
  if(!active||modal.open||e.ctrlKey||e.metaKey||e.altKey)return;const key=e.key.toLowerCase();
  if(['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright','e','m','j','escape',' '].includes(key))e.preventDefault();
  if(['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright'].includes(key)){if(world.scene==='outside'){cancelWork();keys.add(key);}return;}
  if(e.repeat)return;if(key==='e'||key===' ')interact();else if(key==='m')mapDialog();else if(key==='j')journalDialog();else if(key==='escape')settingsDialog();
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',stopMovement);
const joystick=$('joystick');
joystick.addEventListener('pointerdown',e=>{if(!active||modal.open||stickId!==null)return;e.preventDefault();cancelWork();stickId=e.pointerId;joystick.setPointerCapture(e.pointerId);moveStick(e);});
joystick.addEventListener('pointermove',e=>{if(e.pointerId===stickId)moveStick(e);});
function moveStick(e){const r=joystick.getBoundingClientRect(),radius=r.width*.32,dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,length=Math.hypot(dx,dy),scale=length>radius?radius/length:1;stick={x:dx*scale/radius,y:dy*scale/radius};$('stick-knob').style.transform='translate('+dx*scale+'px,'+dy*scale+'px)';}
for(const type of ['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(type,e=>{if(e.pointerId===stickId){stickId=null;stick={x:0,y:0};$('stick-knob').style.transform='';}});
document.addEventListener('visibilitychange',()=>{stopMovement();lastFrame=performance.now();if(document.hidden){backupLocal();sound.suspend();}else{sound.resume();if(active&&!guest)saveGame(false);}});
window.addEventListener('pagehide',()=>backupLocal());
window.addEventListener('online',()=>{if(active&&!guest)saveGame(false);});
syncDevice();requestAnimationFrame(frame);
// Local QA can inspect normal runtime state without enabling cheats on published pages.
if(['127.0.0.1','localhost'].includes(location.hostname))window.__antGame={get state(){return state;},get world(){return world;},get active(){return active;},get event(){return currentEvent;},get store(){return store;},startGame,recordAction,interact,saveGame,beginEvent,getCurrentQuest:()=>getCurrentQuest(state),showClear};

