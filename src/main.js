import {VERSION} from './config.js';
import {RANKS,NPCS,QUESTS,EVENTS,ITEMS} from './content.js';
import {createState,normalizeState,getCurrentQuest,applyAction,canCompleteQuest,completeQuest,getRank} from './progression.js';
import {World} from './world.js';
import {RemoteStore} from './storage.js';
import {Sound} from './audio.js';
import {Typewriter} from './dialogue.js';
import {Adventure} from './adventure.js';
import {SCENES,storyQuest,chapter,recordRecruit,eligibleEvent} from './campaign.js';

const $=id=>document.getElementById(id);
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=name=>'<svg aria-hidden="true"><use href="#i-'+name+'"/></svg>';
const readLocal=key=>{try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}};
const writeLocal=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}};
const timeText=s=>Math.floor(s/60)+'분 '+Math.floor(s%60)+'초';
const sound=new Sound();
const modal=$('modal');
let state=createState(),world=null,active=false,userId='',device=readLocal('ant-rpg:device')||null;
let work=null,currentEvent=null,eventWait=80,lastEvent='',autosaveElapsed=0,localElapsed=0,lastFrame=performance.now(),hudElapsed=0;
let writer=null,holdTimer=null,holdDelay=null,authMode='login',authPending=false,forcedLogin=false,stickId=null,stick={x:0,y:0},keys=new Set(),lastNearby=null,lastInteraction=0;
const store=new RemoteStore({onStatus:showSaveStatus,requiredServerMajor:2});
const adventure=new Adventure({getState:()=>state,getWorld:()=>world,talk:talkDialogue,close:closeModal,work:doWork,notify:toast,changed:()=>{updateHUD();backupLocal();},save:()=>saveGame(false),clear:()=>{recordAction('royal','royal');finishQuest();},stopEvent:()=>{currentEvent=null;state.campaign.긴급=null;world?.setEvent(null);}});
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
function stopDialogueHold(){clearTimeout(holdDelay);clearInterval(holdTimer);holdDelay=null;holdTimer=null;}
function showModal(eyebrow,html,{locked=false}={}){
  writer?.destroy();writer=null;stopDialogueHold();modal.classList.remove('conversation');stopMovement();cancelWork(false);$('modal-eyebrow').textContent=eyebrow;$('modal-content').innerHTML=html;$('modal-close').hidden=locked;
  modal.dataset.locked=String(locked);if(!modal.open)modal.showModal();sound.play('click');
}
function closeModal(){if(forcedLogin||authPending)return;writer?.destroy();stopDialogueHold();modal.close();lastFrame=performance.now();}
$('modal-close').onclick=closeModal;
modal.addEventListener('cancel',e=>{if(forcedLogin||authPending||modal.dataset.locked==='true')e.preventDefault();});
modal.addEventListener('close',()=>{if(modal.open)return;writer?.destroy();stopDialogueHold();lastFrame=performance.now();});
function talkDialogue(role,title,text,choices){
  showModal(role,'<h2>'+escapeHTML(title)+'</h2><button id="spoken-line" class="spoken-line" aria-label="대사: 누르면 한 글자 더 표시"></button><small class="type-hint">누르면 한 글자 더 · 길게 누르면 빠르게</small><div class="dialogue-actions" id="spoken-choices"></div>');
  modal.classList.add('conversation');const area=$('spoken-line');
  writer=new Typewriter(area,{text,interval:32});writer.start();
  area.onclick=()=>writer?.advanceOne();
  area.onpointerdown=()=>{stopDialogueHold();holdDelay=setTimeout(()=>{holdTimer=setInterval(()=>writer?.advanceOne(),12);},250);};
  for(const name of ['pointerup','pointerleave','pointercancel'])area.addEventListener(name,stopDialogueHold);
  for(const choice of choices){const button=document.createElement('button');button.className='secondary';button.textContent=choice.label;button.onclick=()=>{writer?.finish();stopDialogueHold();choice.run();};$('spoken-choices').append(button);}
}
function stopMovement(){keys.clear();stick={x:0,y:0};stickId=null;$('stick-knob').style.transform='';world?.setInput(0,0);}
function syncDevice(){
  const mobile=device?.type==='mobile';
  document.body.classList.toggle('mobile',mobile);
  const viewport=window.visualViewport;
  const h=Math.floor(Math.min(window.innerHeight,viewport?.height||window.innerHeight));
  document.documentElement.style.setProperty('--visible-height',h+'px');
  document.documentElement.style.setProperty('--viewport-top',(viewport?.offsetTop||0)+'px');
  world?.resize();
}
function collapseQuest(){
  $('quest-card').classList.add('collapsed');
  $('quest-toggle').setAttribute('aria-expanded','false');
}
window.addEventListener('resize',syncDevice);
window.visualViewport?.addEventListener('resize',syncDevice);
window.visualViewport?.addEventListener('scroll',syncDevice);
function deviceDialog(returnToSettings=false){
  showModal('나에게 맞는 화면','<h2>어디에서 플레이할까요?</h2><p>기기에 맞춰 화면과 조작을 준비할게요.<br>설정에서 언제든 바꿀 수 있어요.</p><div class="device-options"><button id="choose-pc" class="device-option"><svg viewBox="0 0 40 40"><rect x="3" y="5" width="34" height="23" rx="3"/><path d="M20 28v7m-9 0h18"/></svg>PC로 플레이<small>마우스 · 키보드</small></button><button id="choose-mobile" class="device-option"><svg viewBox="0 0 40 40"><rect x="10" y="2" width="20" height="36" rx="4"/><path d="M17 6h6m-5 27h4"/></svg>모바일로 플레이<small>터치 · 조이스틱</small></button></div>');
  const choose=type=>{
    device={type};writeLocal('ant-rpg:device',device);syncDevice();
    if(type==='mobile')collapseQuest();
    else{$('quest-card').classList.remove('collapsed');$('quest-toggle').setAttribute('aria-expanded','true');}
    returnToSettings?settingsDialog():authDialog();
  };
  $('choose-pc').onclick=()=>choose('pc');
  $('choose-mobile').onclick=()=>choose('mobile');
}
function authDialog(message=''){
  const signup=authMode==='register';
  showModal('작은 숲의 식구가 되어 주세요','<h2>'+(signup?'처음 만나는 우리 군락':'다시 만나서 반가워요')+'</h2><div class="auth-tabs"><button id="tab-login" class="'+(!signup?'active':'')+'">로그인</button><button id="tab-register" class="'+(signup?'active':'')+'">처음 왔어요</button></div><form id="auth-form"><div class="form-row"><label for="user-id">사용자 아이디</label><input id="user-id" name="username" autocomplete="username" maxlength="12" placeholder="한글 두 글자부터 열두 글자" value="'+escapeHTML(userId||'')+'" required><small>한글만 사용할 수 있어요. 예: 풀잎개미</small></div><div class="form-row"><label for="user-pin">네 자리 PIN</label><input id="user-pin" name="password" type="password" inputmode="numeric" autocomplete="'+(signup?'new-password':'current-password')+'" pattern="[0-9]{4}" minlength="4" maxlength="4" placeholder="숫자 네 자리" required></div><p id="auth-error" class="form-error" '+(!message?'hidden':'')+'>'+escapeHTML(message)+'</p><button id="auth-submit" class="primary full" type="submit">'+(signup?'새 식구로 시작하기':'이어서 플레이하기')+'</button></form><p class="form-note">진행 상황을 불러오기 위해 계정과 진행 데이터를 저장합니다</p>'+(forcedLogin?'<button id="conflict-exit" class="text-button full">시작 화면으로 돌아가기</button>':''),{locked:forcedLogin});
  $('tab-login').onclick=()=>{authMode='login';authDialog();};$('tab-register').onclick=()=>{authMode='register';authDialog();};
  $('auth-form').onsubmit=async e=>{
    e.preventDefault();const id=$('user-id').value.trim(),pin=$('user-pin').value;
    if(!/^[가-힣]{2,12}$/.test(id)||!/^\d{4}$/.test(pin)){showAuthError('아이디는 한글 2~12자, PIN은 숫자 네 자리로 입력해 주세요.');return;}
    authPending=true;for(const id of ['tab-login','tab-register','conflict-exit'])if($(id))$(id).disabled=true;$('modal-close').hidden=true;const button=$('auth-submit');button.disabled=true;button.textContent='군락의 기록을 확인하고 있어요…';$('auth-error').hidden=true;
    try{const result=await store[authMode](id,pin);forcedLogin=false;startGame(id,result.state);if(result.recoveredLocal)toast('기기에 남은 진행을 이어서 불러왔어요.');}
    catch(error){if(modal.open&&$('auth-error'))showAuthError(error.message);}
    finally{authPending=false;for(const id of ['tab-login','tab-register','conflict-exit'])if($(id))$(id).disabled=false;$('modal-close').hidden=forcedLogin;if($('auth-submit')){$('auth-submit').disabled=false;$('auth-submit').textContent=signup?'새 식구로 시작하기':'이어서 플레이하기';}}
  };
  if($('conflict-exit'))$('conflict-exit').onclick=()=>{forcedLogin=false;endGame(false);};
}
function showAuthError(text){$('auth-error').textContent=text;$('auth-error').hidden=false;}
function startGame(id,raw){
  active=false;state=raw?normalizeState(raw):createState();userId=id;
  $('welcome').hidden=true;$('game').hidden=false;modal.close();
  world=new World($('world'),{npcs:NPCS,onNotice:message=>toast(message),onTrespass:room=>adventure.trespass(room)});world.setState(state);world.applySnapshot(state.world);
  sound.unlock();sound.setVolumes(state.settings.bgm,state.settings.sfx);
  currentEvent=null;eventWait=75;lastEvent='';autosaveElapsed=0;localElapsed=0;work=null;adventure.playerHealth=100;adventure.bossClock=0;adventure.skirmish=null;
  $('event-banner').hidden=true;syncDevice();if(device?.type==='mobile')collapseQuest();active=true;lastFrame=performance.now();updateHUD();backupLocal();
  showSaveStatus({kind:'saved',message:'진행 상황을 불러왔어요'});
  if(!state.cleared&&state.questIndex===29&&state.campaign.단계===24){recordAction('royal','royal');finishQuest();return;}
  if(state.cleared){world.recruit(5);toast('여왕님, 오늘은 어떤 산책을 해 볼까요?');}
  else if(state.questIndex===0){toast('선배 봄이가 기다려요. 가까이 가서 인사해 보세요.');}
  else toast('반가워요. 지난 발걸음에서 이어가요.');
  restoreEmergency();
}
function snapshot(){if(world)state.world=world.getSnapshot();return state;}
function backupLocal(){
  if(!active)return false;snapshot();
  const ok=store.saveLocal(state);
  if(!ok)showSaveStatus({kind:'error',message:'기기 저장 공간을 확인해 주세요'});
  return ok;
}
async function saveGame(manual=false){
  if(!active)return {ok:false};snapshot();
  const result=await store.save(state);if(['SESSION_CONFLICT','REVISION_CONFLICT','INVALID_SESSION','SESSION_EXPIRED'].includes(result.code)){active=false;stopMovement();forcedLogin=true;authMode='login';authDialog(result.message||'다른 곳에서 계정이 사용됐어요. 다시 로그인해 주세요.');}
  if(manual&&active)toast(result.ok?'군락의 기록을 안전하게 저장했어요.':'연결을 확인해 주세요. 진행은 기기에 임시 보관했어요.',!result.ok);
  return result;
}
async function endGame(save=true){
  if(save&&active)await saveGame(false);backupLocal();active=false;work=null;currentEvent=null;world?.setEvent(null);stopMovement();store.logout();modal.close();$('game').hidden=true;$('welcome').hidden=false;$('toast-area').innerHTML='';sound.suspend();forcedLogin=false;
}
function updateHUD(){
  if(!world)return;const base=getCurrentQuest(state),q=storyQuest(state)||base,ready=!storyQuest(state)&&canCompleteQuest(state),c=chapter(state);world.setState(state);
  $('player-name').textContent=userId;$('player-rank').textContent=getRank(state).name+' · 공헌도 '+state.xp;
  $('place-name').textContent=SCENES[world.scene]||'작은 숲';
  $('day-label').textContent=['햇살이 머무는 아침','느긋한 숲의 오후','노을이 번지는 시간','별빛 아래의 군락'][Math.floor(state.stats.playSeconds/240)%4];
  $('quest-number').textContent='제'+c.number+'장';$('quest-summary').textContent=q?q.title:c.title;
  $('quest-title').textContent=q?q.title:'여왕의 열린 문';$('quest-description').textContent=q?(ready?q.npc+'에게 돌아가 이야기를 마무리하세요.':q.description):'원정과 교역, 동료들의 부탁이 이어집니다. 쉬고 싶을 때는 여왕 명령으로 일을 맡겨 보세요.';
  const progress=storyQuest(state)?state.campaign.진행:state.questProgress;
  $('quest-count').textContent=q?progress+' / '+q.count:'CLEAR';
  $('quest-fill').style.width=q?Math.min(100,progress/q.count*100)+'%':'100%';
  $('quest-owner').textContent=storyQuest(state)?SCENES[q.scene]:q?q.npc+'의 부탁':c.title;
  for(const key of Object.keys(ITEMS))$('item-'+key).textContent=state.inventory[key];
  $('joystick').hidden=false;$('home-button').hidden=world.scene!=='outside';$('queen-button').hidden=!state.cleared;
  if(currentEvent){$('event-banner').hidden=false;$('event-name').textContent=currentEvent.name;$('event-description').textContent=currentEvent.description;$('event-count').textContent=Math.floor(currentEvent.progress)+' / '+currentEvent.count+' · '+Math.ceil(currentEvent.remaining)+'초';$('event-guide').textContent='자세히 보기';}
  else $('event-banner').hidden=true;
  const royalCombat=state.campaign.단계===23&&world.scene==='throne',combat=royalCombat||!!adventure.skirmish;$('combat-status').hidden=!combat;
  if(combat)$('combat-status').textContent=(royalCombat?'은빛 '+Math.ceil(state.campaign.왕실체력):'거점 공방전 '+(Math.floor(adventure.skirmish.hits/3)+1)+' / 3')+' · 나의 힘 '+adventure.playerHealth+' · 붉은 원을 피하세요';
  $('chapter-tag').textContent=c.title;
  sound.setTheme(combat?'battle':currentEvent?.type==='defend'?'danger':['prison','depths'].includes(world.scene)?'depths':state.cleared?'royal':'life');
}
function recordAction(type,target,count=1){
  const before=canCompleteQuest(state);applyAction(state,type,target,count);
  if(currentEvent&&currentEvent.type===type&&currentEvent.target===target){currentEvent.progress=Math.min(currentEvent.count,currentEvent.progress+count);world.setEvent(currentEvent);if(currentEvent.progress>=currentEvent.count)finishEvent(true);}
  if(!before&&canCompleteQuest(state)){sound.play('reward');toast(getCurrentQuest(state).npc+'에게 돌아가면 임무를 마칠 수 있어요.');}
  updateHUD();backupLocal();
}
function cancelWork(notify=true){world?.setActivity?.(null);if(work){work=null;$('work-progress').hidden=true;if(notify)toast('작업을 멈췄어요. 다시 시작할 수 있어요.');}}
function doWork(label,seconds,done){
  if(!active||work)return;modal.close();stopMovement();world.path=[];work={label,duration:seconds/(1+state.campaign.강화.작업*.12),elapsed:0,done,scene:world.scene};$('work-progress').hidden=false;$('work-progress').querySelector('span').textContent=label;$('work-progress').querySelector('i').style.width='0%';sound.play('work');
}
function finishQuest(){
  const result=completeQuest(state);if(!result.ok)return;
  closeModal();sound.play(result.rankUp?'rank':'reward');world.setState(state);backupLocal();updateHUD();
  if(result.cleared){world.recruit(5);showClear();saveGame(false);}
  else if(result.rankUp){const rank=getRank(state);showModal('또 한 걸음, 성장했어요','<svg class="clear-crown"><use href="#i-leaf"/></svg><div class="clear-title"><h2>'+rank.name+'</h2><p>'+escapeHTML(rank.perk)+'</p></div><div class="clear-detail">작은 일을 함께해 온 동료들이<br>당신의 새로운 시작을 응원해요.</div><button id="rank-continue" class="primary full">새로운 하루로</button>');$('rank-continue').onclick=closeModal;}
  else{toast('임무 완료 · 공헌도 +'+result.quest.xp);if(device?.type==='mobile')collapseQuest();}
}
function npcDialog(entity){
 const npc=NPCS.find(n=>n.id===entity.id);if(!npc)return;
 const q=getCurrentQuest(state),owns=q?.npc===npc.id;
 const idx=state.cleared?2:state.rank>=2?1:0;
 let line=npc.dialogue[idx];
 const clues={책갈피:' 기록에는 빈 줄이 있어. 식량을 공평하게 나누자던 개미들의 이름이 지워졌거든.',단단:' 문을 지키는 게 내 일이지만, 누구를 위해 닫는지는 가끔 모르겠어.',파삭:' 공사장에서 차가운 바람이 불어. 누군가 먼저 파던 길이 아래에 있나 봐.',은빛:' 군락이 네 이름을 너무 자주 부르는군. 왕관은 하나뿐이라는 걸 기억하거라.'};
 if(!state.cleared&&state.rank>=1)line+=clues[npc.id]||'';
 const choices=[];
 if(owns&&q.type==='talk'&&!canCompleteQuest(state)){
  choices.push({label:'이야기를 듣고 힘을 보탤게요.',run:()=>{recordAction('talk',npc.id);npcDialog(entity);}});
  choices.push({label:'부탁은 됐고 보상부터 주세요.',run:()=>talkDialogue(npc.role,npc.name,'넌 내가 찾던 개미가 아니야. 서로의 이야기를 듣는 것부터 시작하자.',[{label:'다시 생각해 볼게요',run:closeModal}])});
 }else{
  if(owns&&canCompleteQuest(state))choices.push({label:'이야기 마무리 · 공헌도 +'+q.xp,run:finishQuest});
  else if(owns&&q.type==='deliver')choices.push({label:ITEMS[q.target].name+' 전달 · '+state.inventory[q.target]+'개 보유',run:()=>{const n=Math.min(state.inventory[q.target],q.count-state.questProgress);if(!n){toast('먹이를 더 모아 주세요.',true);return;}state.inventory[q.target]-=n;recordAction('deliver',q.target,n);npcDialog(entity);}});
  if(npc.id==='두리'&&state.rank>=2)choices.push({label:'운반조 모집 · 최대 '+(state.rank>=3?5:3)+'마리',run:()=>{const added=world.recruit(state.rank>=3?5:3);recordRecruit(state,added,world.followers.length);updateHUD();backupLocal();toast('동료 '+world.followers.length+'마리 · 새 합류 '+added+'마리');npcDialog(entity);}});
 }
 if(['보리','뚝딱'].includes(npc.id))choices.push({label:'씨앗으로 도구 사기 / 일거리',run:()=>adventure.shop()});
 if(npc.id==='은빛'&&state.cleared)choices.push({label:'여왕의 명령',run:()=>adventure.queen()});
 choices.push({label:'다음에 또 이야기하자',run:()=>{if(!owns)recordAction('talk',npc.id);closeModal();}});
 talkDialogue(npc.role,npc.name,line+(owns?'\n\n부탁: '+q.title:''),choices);
}
function stationAction(entity,chosenType){
  if(adventure.interact(entity))return;
  const q=getCurrentQuest(state);
  const type=chosenType||(entity.type==='dig'?'dig':entity.kind==='nursery'?'care':entity.kind==='rest'?'rest':entity.kind==='scout'?'scout':entity.id==='predator'?'defend':q?.target==='guard'&&!canCompleteQuest(state)?q.type:currentEvent?.target==='guard'?currentEvent.type:'defend');
  const target=entity.type==='dig'?'dig':entity.id==='predator'?'predator':entity.kind;
  const labels={dig:'흙을 다지고, 새 길을 넓히는 중',care:'작은 알의 이불을 정리하는 중',rest:'풀잎 노래를 들으며 쉬는 중',scout:'바람과 발자국을 살펴보는 중',defend:entity.id==='predator'?'동료들과 힘을 모아 밀어내는 중':'동료들과 방어 대형을 맞추는 중',repair:'잎과 흙으로 빗물을 막는 중'};
  if(type==='dig'&&world.graph.open)labels.dig='새싹의 방 바닥과 흙벽을 보강하는 중';
  world.setActivity?.(entity);
  doWork(labels[type]||'군락을 돕는 중',type==='rest'?3.5:type==='scout'?3:2.8,()=>{if(type==='dig'){world.dig();world.burst(entity.x,entity.y,'#b4865b',12);}if(type==='defend')world.burst?.(entity.x,entity.y,'#dfcd8c',14);const guards=entity.id==='predator'?world.guardAnts.filter(ant=>ant.scene===world.scene&&Math.hypot(ant.x-entity.x,ant.y-entity.y)<150).length:0;recordAction(type,target,1+Math.floor(guards/2));world.setActivity?.(null);sound.play('work');});
}
function interact(){
  if(!active||modal.open||work||performance.now()-lastInteraction<220)return;lastInteraction=performance.now();
  const entity=world.nearest();if(!entity)return;
  if(adventure.interact(entity))return;
  if(entity.type==='npc'){npcDialog(entity);return;}
  if(entity.type==='exit'){adventure.portal({destination:world.scene==='nest'?'outside':'nest'});sound.play('click');return;}
  if(entity.type==='resource'){
    const heavy=ITEMS[entity.kind].weight>1,need=entity.kind==='berry'?3:2;
    if(heavy&&world.followers.length<need){toast('큰 먹이는 동료 '+need+'마리와 함께 들어요. 만남의 광장에서 두리를 만나 보세요.',true);return;}
    world.setActivity?.(entity);
    doWork(heavy?'함께 하나, 둘! 먹이를 옮기는 중':ITEMS[entity.kind].name+' 모으는 중',heavy?4:2.2,()=>{if(world.consume(entity.id)){const amount=1+state.campaign.강화.운반;state.inventory[entity.kind]+=amount;recordAction('gather',entity.kind,amount);world.setActivity?.(null);sound.play('reward');toast(ITEMS[entity.kind].name+' +'+amount);}});
    return;
  }
  stationAction(entity);
}
function queenDialog(){adventure.queen();}
function showClear(){
  sound.play('clear');world.burst?.(world.player.x,world.player.y,'#f0ce79',50);
  showModal('작은 발걸음이 모여, 우리의 여왕으로','<svg class="clear-crown"><use href="#i-crown"/></svg><div class="clear-title"><p>개미 키우기 RPG · 클리어</p><h2>'+escapeHTML(userId)+' 여왕님,<br>즉위를 축하해요.</h2><p>왕관보다 빛나는 건<br>함께 걸어온 동료들의 마음이에요.</p></div><div class="clear-detail">함께 마친 이야기 <b>'+state.completed.length+'개</b><br>도와준 작은 일 <b>'+Math.floor(state.stats.helped)+'번</b><br>군락에서 보낸 시간 <b>'+timeText(state.stats.playSeconds)+'</b></div><div class="clear-actions"><button id="clear-continue" class="primary full">여왕의 일상으로 계속하기</button></div>');
  $('clear-continue').onclick=()=>{closeModal();eventWait=120;toast('이야기는 클리어했지만, 우리의 일상은 계속돼요.');};
}
function beginEvent(event){
  if(!event)return;currentEvent={...event,progress:0,remaining:event.type==='defend'?180:event.duration};
  if(event.type==='defend')Object.assign(currentEvent,{name:'비상! 천적이 접근합니다',target:'predator',description:'경비 개미들과 정원의 천적을 막으세요. 55초부터 입구로 접근하고, 20초부터 굴 안으로 들어옵니다. 시간이 다 되면 군락이 무너집니다.',count:12});
  if(['defend','repair'].includes(event.type))state.campaign.긴급={'종류':event.type==='defend'?'천적':'비','남은초':currentEvent.remaining,'진척':0,'지시':false,'실패':false};
  lastEvent=event.id;world.setEvent(currentEvent);sound.play('event');toast(currentEvent.name);updateHUD();backupLocal();
}
function finishEvent(success){
  if(!currentEvent)return;
  if(!success&&currentEvent.type==='defend'){state.campaign.긴급.실패=true;currentEvent=null;world.setEvent(null);showExtinction();backupLocal();return;}
  if(success){state.stats.events++;state.xp+=currentEvent.reward;if(!state.discoveries.includes(currentEvent.name))state.discoveries.push(currentEvent.name);toast('함께 해결했어요! 공헌도 +'+currentEvent.reward);sound.play('reward');}
  else toast('다른 동료들이 일을 마무리했어요. 다음에 함께해요.');
  currentEvent=null;state.campaign.긴급=null;world.setEvent(null);$('event-banner').hidden=true;eventWait=100+Math.random()*65;backupLocal();
}
function tickEvents(dt){
  if(currentEvent){
    currentEvent.remaining-=dt;const emergency=state.campaign.긴급;
    if(emergency){
      emergency.남은초=Math.max(0,currentEvent.remaining);emergency.진척=currentEvent.progress;
      if(emergency.지시&&state.cleared){currentEvent.progress=Math.min(currentEvent.count,currentEvent.progress+dt*.45);world.setEvent(currentEvent);}
      if(currentEvent.type==='defend'&&currentEvent.remaining<55&&!currentEvent.invasion){currentEvent.invasion=true;toast('천적이 입구에 도착했어요! 마지막 방어선입니다.',true);}
      if(currentEvent.type==='defend')world.setEvent(currentEvent);
    }
    if(currentEvent.progress>=currentEvent.count)finishEvent(true);else if(currentEvent.remaining<=0)finishEvent(false);
  }else if(!state.campaign.긴급?.실패){eventWait-=dt;if(eventWait<=0){const pool=EVENTS.filter(e=>eligibleEvent(state,e,world.followers.length)&&e.id!==lastEvent);if(pool.length)beginEvent(pool[Math.floor(Math.random()*pool.length)]);else eventWait=15;}}
}
function showExtinction(){
 showModal('군락의 마지막 불빛','<h2>멸망 엔딩 · 닫혀 버린 숲</h2><p>경비대는 끝까지 버텼지만 천적이 알방까지 밀려왔습니다. 흩어진 식구들이 마지막으로 당신을 찾습니다.</p><div class="clear-detail">이야기와 성장 기록은 남아 있습니다.<br>천적이 발견되기 전으로 돌아가 다시 지킬 수 있어요.</div><button id="retry-colony" class="primary full">방어 전으로 돌아가기</button>',{locked:true});
  $('retry-colony').onclick=()=>{state.campaign.긴급=null;eventWait=25;world.setMode('nest');closeModal();backupLocal();};
}
function restoreEmergency(){
 const e=state.campaign.긴급;if(!e)return;if(e.실패){showExtinction();return;}
 const original=EVENTS.find(x=>x.type===(e.종류==='천적'?'defend':'repair'));
 if(original){currentEvent={...original,remaining:e.남은초,progress:e.진척,count:e.종류==='천적'?12:original.count};if(e.종류==='천적')Object.assign(currentEvent,{target:'predator',name:'비상! 천적이 접근합니다'});world.setEvent(currentEvent);}
}
function settingsDialog(){
  showModal('나의 작은 숲 설정','<h2>편안하게 머물러요</h2><div class="setting-row"><label for="bgm-volume">배경 음악 <span id="bgm-value">'+Math.round(state.settings.bgm*100)+'%</span></label><input id="bgm-volume" type="range" min="0" max="100" value="'+Math.round(state.settings.bgm*100)+'"></div><div class="setting-row"><label for="sfx-volume">효과음 <span id="sfx-value">'+Math.round(state.settings.sfx*100)+'%</span></label><input id="sfx-volume" type="range" min="0" max="100" value="'+Math.round(state.settings.sfx*100)+'"></div><div class="settings-buttons"><button id="save-now" class="primary">'+icon('save')+' 지금 저장</button><button id="change-device" class="secondary">기기 변경</button><button id="controls-help" class="secondary">조작 도움말</button><button id="logout" class="secondary">저장하고 로그아웃</button></div><p class="form-note">계정으로 로그인 중 · 1분마다 자동 저장됩니다.</p><div class="setting-meta"><span>'+(device?.type==='mobile'?'모바일':'PC')+'</span><span>v'+VERSION+'</span></div>');
  for(const key of ['bgm','sfx'])$(key+'-volume').oninput=()=>{state.settings[key]=Number($(key+'-volume').value)/100;$(key+'-value').textContent=Math.round(state.settings[key]*100)+'%';sound.setVolumes(state.settings.bgm,state.settings.sfx);if(key==='sfx')sound.play('click');backupLocal();};
  $('save-now').onclick=async()=>{const button=$('save-now');button.disabled=true;button.textContent='저장 중…';const result=await saveGame(true);if(button.isConnected){button.disabled=false;button.innerHTML=icon('save')+(result.ok?' 저장 완료':' 다시 저장');}};
  $('change-device').onclick=()=>deviceDialog(true);$('logout').onclick=()=>endGame(true);$('controls-help').onclick=helpDialog;
}
function helpDialog(){
 showModal('작은 숲 생활 안내','<h2>직접 걸어가는 모험</h2><div class="clear-detail"><b>이동</b> · 굴 안팎 모두 PC는 WASD/방향키, 모바일은 조이스틱.<br><b>상호작용</b> · 대상 가까이에서 E 또는 오른쪽 아래 버튼.<br><b>지도</b> · M 또는 지도 버튼으로 방 이름과 위치를 확인.<br><b>귀환 페로몬</b> · 정원에서 집 버튼을 누르면 길 위에 냄새 흔적이 표시돼요.<br><b>잠긴 문</b> · 등급을 확인하세요. 경고를 무시하면 감옥에 갈 수 있어요.<br><b>대화</b> · 누르면 한 글자 더, 길게 누르면 빠르게 읽어요.<br><b>씨앗 장터</b> · 보리/뚝딱에게 도구와 일거리를 문의하세요.<br><b>비상사태</b> · 천적은 방치하면 굴 안으로 들어옵니다.</div><button id="help-done" class="primary full">알겠어요</button>');
 $('help-done').onclick=closeModal;
}
function mapDialog(){
 showModal('직접 찾아가는 우리의 숲','<h2>'+escapeHTML(SCENES[world.scene])+'</h2><canvas id="map-canvas" class="map-canvas" width="800" height="540" aria-label="현재 위치와 방 지도"></canvas><div class="map-legend"><span>● 나의 위치</span><span>◇ 방과 먹이</span><span>선 · 통로</span></div><p class="form-note">지도를 닫고 직접 이동하세요. 잠긴 방은 필요한 등급을 확인해 주세요.</p>');
 requestAnimationFrame(()=>{if($('map-canvas'))world.drawMap($('map-canvas'));});
}
function journalDialog(tab='friends'){
  const tabs='<div class="journal-tabs"><button data-journal="friends" class="'+(tab==='friends'?'active':'')+'">동료</button><button data-journal="discoveries" class="'+(tab==='discoveries'?'active':'')+'">발견</button><button data-journal="story" class="'+(tab==='story'?'active':'')+'">발걸음</button></div>';
  let cards;
  if(tab==='friends')cards=NPCS.map(n=>'<div class="journal-card '+(state.friendships[n.id]?'':'locked')+'"><b>'+n.name+'</b><small>'+n.role+'</small><small>'+(state.friendships[n.id]?escapeHTML(n.personality):'아직 인사를 나누지 않았어요')+'</small></div>').join('');
  else if(tab==='discoveries')cards=state.discoveries.length?state.discoveries.map(d=>'<div class="journal-card"><b>'+escapeHTML(d)+'</b><small>우리 군락의 기록장에 남겼어요.</small></div>').join(''):'<p>아직 기록장이 비어 있어요. 숲에서 첫 발견을 해 보세요.</p>';
  else cards=RANKS.map((r,i)=>'<div class="journal-card '+(state.rank>=i?'':'locked')+'"><b>'+r.name+'</b><small>'+r.title+'</small><small>'+(state.rank>=i?'함께 걸어온 발걸음':'앞으로 만나게 될 나')+'</small></div>').join('');
  if(tab==='story')cards+='<div class="journal-card"><b>'+chapter(state).title+'</b><small>동맹: '+(state.campaign.동맹.join(' · ')||'아직 없음')+'</small><small>'+state.campaign.수색.map(escapeHTML).join(' · ')+'</small></div>';
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
      state.stats.playSeconds+=elapsed;autosaveElapsed+=elapsed;localElapsed+=elapsed;state.world=world.getSnapshot();tickEvents(elapsed);adventure.tick(elapsed);
      if(work){world.setInput(0,0);world.path=[];work.elapsed+=elapsed;if(world.activity)world.activity.progress=Math.min(1,work.elapsed/work.duration);$('work-progress').querySelector('i').style.width=Math.min(100,work.elapsed/work.duration*100)+'%';if(work.elapsed>=work.duration){const done=work.done;work=null;$('work-progress').hidden=true;world.setActivity?.(null);done();}}
      else{const x=stick.x+(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),y=stick.y+(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);world.setInput(x,y);}
      world.update(elapsed);sound.tick(elapsed,true);
      if(localElapsed>=10){localElapsed=0;backupLocal();}
      if(autosaveElapsed>=60){autosaveElapsed%=60;saveGame(false);}
    }
    world.render();hudElapsed+=elapsed;if(hudElapsed>.15){hudElapsed=0;updateNearby();updateHUD();}
  }
  requestAnimationFrame(frame);
}
$('start-button').onclick=()=>{sound.unlock();deviceDialog();};
$('interact-button').onclick=interact;$('queen-button').onclick=()=>adventure.queen();
$('quest-toggle').onclick=()=>{const collapsed=$('quest-card').classList.toggle('collapsed');$('quest-toggle').setAttribute('aria-expanded',String(!collapsed));};
$('event-name').onclick=()=>{const expanded=$('event-banner').classList.toggle('expanded');$('event-name').setAttribute('aria-expanded',String(expanded));};
$('map-button').onclick=mapDialog;$('journal-button').onclick=()=>journalDialog();$('settings-button').onclick=settingsDialog;
$('home-button').onclick=()=>{const visible=world.toggleHomeTrail();toast(visible?'집의 냄새를 길 위에 표시했어요. 직접 따라 걸어가세요.':'귀환 페로몬 표시를 껐어요.');};
$('event-guide').onclick=()=>{if(currentEvent)talkDialogue('군락 소식',currentEvent.name,currentEvent.description,[{label:'현장에서 돕기',run:closeModal}]);};
window.addEventListener('keydown',e=>{
  if(!active||modal.open||e.ctrlKey||e.metaKey||e.altKey)return;const key=e.key.toLowerCase();
  if(['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright','e','m','j','escape',' '].includes(key))e.preventDefault();
  if(['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright'].includes(key)){cancelWork();keys.add(key);return;}
  if(e.repeat)return;if(key==='e'||key===' ')interact();else if(key==='m')mapDialog();else if(key==='j')journalDialog();else if(key==='escape')settingsDialog();
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',stopMovement);
const joystick=$('joystick');
joystick.addEventListener('pointerdown',e=>{if(!active||modal.open||stickId!==null)return;e.preventDefault();cancelWork();stickId=e.pointerId;joystick.setPointerCapture(e.pointerId);moveStick(e);});
joystick.addEventListener('pointermove',e=>{if(e.pointerId===stickId)moveStick(e);});
function moveStick(e){const r=joystick.getBoundingClientRect(),radius=r.width*.32,dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,length=Math.hypot(dx,dy),scale=length>radius?radius/length:1;stick={x:dx*scale/radius,y:dy*scale/radius};$('stick-knob').style.transform='translate('+dx*scale+'px,'+dy*scale+'px)';}
for(const type of ['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(type,e=>{if(e.pointerId===stickId){stickId=null;stick={x:0,y:0};$('stick-knob').style.transform='';}});
document.addEventListener('visibilitychange',()=>{stopMovement();lastFrame=performance.now();if(document.hidden){backupLocal();sound.suspend();}else{sound.resume();if(active)saveGame(false);}});
window.addEventListener('pagehide',()=>backupLocal());
window.addEventListener('online',()=>{if(active)saveGame(false);});
syncDevice();requestAnimationFrame(frame);
// Local QA can inspect normal runtime state without enabling cheats on published pages.
if(['127.0.0.1','localhost'].includes(location.hostname))window.__antGame={get state(){return state;},get world(){return world;},get active(){return active;},get event(){return currentEvent;},get store(){return store;},get adventure(){return adventure;},startGame,recordAction,interact,saveGame,beginEvent,getCurrentQuest:()=>getCurrentQuest(state),showClear};

