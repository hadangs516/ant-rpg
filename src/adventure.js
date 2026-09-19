import {SCENES,STORY,PASSWORD,PASSWORD_OPTIONS,storyQuest,startBetrayal,advanceStory,answerPassword,accessRegion,buyUpgrade} from './campaign.js';

// Controllers only act on the object the player approached. No remote travel or quest auto-play.
export class Adventure {
 constructor(ui){Object.assign(this,ui);this.bossClock=0;this.playerHealth=100;this.strike=null;this.attackCooldown=0;}
 get state(){return this.getState();} get world(){return this.getWorld();}
 dialogue(name,text,choices){this.talk('군락의 이야기',name,text,choices);}
 change(scene){this.close();if(scene!=='frontier')this.skirmish=null;this.world.bossTelegraph=null;this.world.setMode(scene);this.state.world=this.world.getSnapshot();this.step('enter',scene);this.changed();}
 step(type,id,amount=1){
  const before=this.state.campaign.단계;
  if(advanceStory(this.state,type,id,amount)){
   if(this.state.campaign.단계!==before){this.notify('이야기 완료 · '+STORY[before].title);this.save();}
   this.changed();return true;
  }return false;
 }
 trespass(room){
  const c=this.state.campaign;if(c.감옥!=='없음')return;
  c.침입++;this.notify(room.name+'은 아직 출입할 수 없어요. 경고 '+c.침입+' / 3',true);
  if(c.침입>=3){this.stopEvent();c.감옥='일반';c.형기=45;c.침입=0;this.change('prison');this.dialogue('간수 잔뿌리','세 번이나 금지된 문을 두드렸구나. 잠깐 여기서 규칙을 익히자. 45초를 기다리거나 씨앗 다섯 개를 내면 나갈 수 있어. 바닥 정리를 도와줘도 좋고.',[{label:'알겠어요',run:()=>this.close()}]);this.save();}
 }
 prison(){
  const c=this.state.campaign;
  if(c.감옥==='이야기'){this.dialogue('간수 잔뿌리','은빛 여왕께서 직접 내린 명령이야. 돈으로도, 기다려도 풀어줄 수 없어. …저 벽에서 나는 바람 소리는 못 들은 걸로 하지.',[{label:'주변을 살펴본다',run:()=>this.close()}]);return;}
  this.dialogue('간수 잔뿌리','남은 시간은 '+Math.ceil(c.형기)+'초야. 다음에는 표지판을 먼저 읽어 줘.',[
   {label:c.형기<=0?'시간이 됐어요 · 석방':'조금 더 기다릴게요',run:()=>{if(c.형기<=0)this.release();else this.close();}},
   {label:'씨앗 5개 내고 나가기',run:()=>{if(this.state.inventory.seed<5){this.notify('씨앗이 부족해요. 기다리거나 청소하면 돼요.',true);return;}this.state.inventory.seed-=5;this.release();}},
   {label:'바닥 정리 · 형기 15초 줄이기',run:()=>this.work('바닥의 흙을 정리하는 중',4,()=>{c.형기=Math.max(0,c.형기-15);this.changed();this.notify('형기 15초 감소');})}
  ]);
 }
 release(){this.state.campaign.감옥='없음';this.state.campaign.형기=0;this.change('nest');this.notify('다시 군락으로 돌아왔어요.');this.save();}
 offerCrown(){
  const s=this.state;
  if(s.cleared){this.queen();return;}
  if(s.questIndex!==29){this.dialogue('은빛','군락의 신뢰를 더 쌓고 돌아오거라.',[{label:'이야기를 마친다',run:()=>this.close()}]);return;}
  this.dialogue('은빛 여왕','식구들이 모두 네 이름을 부르는구나. 그럼 마지막으로 묻겠다. 너는… 여왕이 되겠느냐?',[
   {label:'네. 모두와 함께하는 여왕이 되겠습니다.',run:()=>{if(!startBetrayal(s))return;this.stopEvent();this.change('prison');this.dialogue('닫히는 문','“감히 내 자리를 탐내다니!” 은빛의 명령에 문이 닫혔다. 차가운 벽 아래, 오래된 흙가루가 바람에 흩어진다.',[{label:'방 안을 살펴본다',run:()=>this.close()}]);this.save();}},
   {label:'아직 마음의 준비가 필요합니다.',run:()=>this.close()}
  ]);
 }
 portal(entity){
  const s=this.state,reason=accessRegion(s,entity.destination);
  if(reason){this.notify(reason,true);return;}
  const ticket={moss:'이끼',reed:'갈대'}[entity.destination];
  if(ticket&&!s.campaign.통행증.includes(ticket)){
   this.dialogue(ticket+' 군락 문지기','씨앗 세 개로 방문증을 발급하고 있어. 돈이 없다면 문 앞의 흙을 치워줘. 한 번 받으면 계속 드나들 수 있어.',[
    {label:'씨앗 3개 · 영구 방문증',run:()=>{if(s.inventory.seed<3){this.notify('씨앗이 부족해요. 문지기를 도울 수도 있어요.',true);return;}s.inventory.seed-=3;s.campaign.통행증.push(ticket);this.change(entity.destination);}},
    {label:'문 앞 정리하기 · 방문증 받기',run:()=>this.work('문 앞을 정리하는 중',5,()=>{s.campaign.통행증.push(ticket);this.change(entity.destination);})},
    {label:'다음에 올게요',run:()=>this.close()}
   ]);return;
  }
  this.change(entity.destination);
 }
 interact(entity){
  if(entity.type==='portal'){this.portal(entity);return true;}
  if(entity.kind==='royal'){this.offerCrown();return true;}
  if(entity.id==='상점'){this.shop();return true;}
  if(entity.type!=='story')return false;
  if(entity.id==='간수'){this.prison();return true;}
  if(entity.id==='원정깃발'){if(this.skirmish)this.attack();else this.expedition();return true;}
  const s=this.state,q=storyQuest(s);
  if(entity.id==='은빛전투'&&s.campaign.단계===23){this.attack();return true;}
  if(entity.id==='메아리'&&s.campaign.단계>8){this.dialogue('메아리','순서는 '+PASSWORD.join(' → ')+'. 다섯 약속을 기억해. 정답이 틀려도 다시 시작하면 돼.',[{label:'기억했어',run:()=>this.close()}]);return true;}
  if(!q||q.scene!==this.world.scene||q.target!==entity.id){
   const text=s.cleared?'다시 열린 문으로 친구들이 오고 있어요. 오늘은 어떤 이야기를 만들어 볼까요?':s.campaign.단계===0?'이곳의 친구들은 군락 사이의 닫힌 문을 걱정하고 있어요. 내 군락에서 신뢰를 쌓으면 더 많은 이야기를 듣게 됩니다.':q?.description||'조용한 숨소리가 들려요.';
   this.dialogue(entity.name,text,[{label:'주변을 둘러본다',run:()=>this.close()}]);return true;
  }
  if(q.type==='quiz'){this.quiz();return true;}
  if(q.type==='talk'){
   const answer={돌개:'남은 친구들도 함께 데려가자.',초롱:'물과 길을 모두에게 나누고 싶어.',모래:'열린 문을 함께 지켜 줘.',메아리:'다섯 약속을 기억할게.'}[entity.id]||'함께 힘을 보탤게.';
   this.dialogue(entity.name,q.line,[{label:answer,run:()=>{this.step('talk',entity.id);this.close();}},{label:'내가 여왕이 되는 일부터 도와줘.',run:()=>this.dialogue(entity.name,'넌 내가 찾던 개미가 아니야. 다른 이의 사정을 먼저 들어 줬으면 좋겠어.',[{label:'생각을 정리하고 다시 온다',run:()=>this.close()}])}]);return true;
  }
  if(q.type==='deliver'){
   const label=q.item==='dew'?'이슬':'과자 부스러기';
   this.dialogue(entity.name,q.line,[{label:label+' '+q.count+'개 전달 · 보유 '+s.inventory[q.item]+'개',run:()=>{const n=Math.min(s.inventory[q.item],q.count-s.campaign.진행);if(!n){this.notify('정원에서 '+label+'을 모아 주세요.',true);return;}s.inventory[q.item]-=n;this.step('deliver',q.target,n);this.close();}}]);return true;
  }
  if(q.target==='비밀승강기'&&(s.campaign.동맹.length<3||s.xp<3200)){this.notify('동맹 세 명과 공헌도 3,200이 필요해요. 외부 군락의 일을 더 도와주세요.',true);return true;}
  this.world.setActivity?.(entity);
  this.work(q.title+' · '+(s.campaign.진행+1)+' / '+q.count,q.type==='inspect'?2.5:4.5,()=>{
   this.world.burst(entity.x,entity.y,q.type==='dig'?'#c7a778':'#b6d7a0',12);this.step(q.type,q.target);this.world.setActivity?.(null);
   if(q.type==='inspect')this.dialogue(entity.name,q.line,[{label:'기록하고 계속하기',run:()=>this.close()}]);
  });return true;
 }
 quiz(){
  const s=this.state,step=s.campaign.암호순서;
  this.dialogue('오래된 약속의 문','다섯 약속 중 '+(step+1)+'번째를 말하라.',PASSWORD_OPTIONS[step].map((label,index)=>({label,run:()=>{
   const result=answerPassword(s,index);this.changed();
   if(!result.ok)this.dialogue('오래된 약속의 문','넌 내가 기다리던 개미가 아니야. 메아리에게 약속을 다시 듣고 와.',[{label:'다시 기억해 본다',run:()=>this.close()}]);
   else if(result.complete){this.close();this.notify('다섯 약속이 맞물리며 문이 열렸어요.');this.save();}
   else this.quiz();
  }})));
 }
 shop(){
  const s=this.state;
  this.dialogue('씨앗 장터 · 보리','모은 씨앗은 길을 걷는 힘이 되기도 하지. 공헌도는 쓰지 않아. 그건 친구들의 신뢰니까.',[
   ...['이동','작업','운반'].map(key=>({label:key+' 도구 '+s.campaign.강화[key]+'/3 · 씨앗 '+8*(s.campaign.강화[key]+1)+'개',run:()=>{if(buyUpgrade(s,key)){this.notify(key+' 도구를 강화했어요.');this.changed();this.shop();}else this.notify('씨앗이 부족하거나 최고 단계예요.',true);}})),
   {label:'군락 일거리 · 씨앗 3개 / 공헌도 20',run:()=>this.work('창고의 씨앗을 분류하는 중',8,()=>{s.inventory.seed+=3;s.xp+=20;s.stats.helped++;this.changed();this.notify('씨앗 +3 · 공헌도 +20');})},
   {label:'장을 나간다',run:()=>this.close()}
  ]);
 }
 queen(){
  const s=this.state,c=s.campaign;
  this.dialogue('열린 문 너머의 여왕','오늘은 직접 걸어도 좋고, 친구들에게 일을 맡겨도 좋아요. 원정은 정원 남동쪽 바람의 변경에서 시작합니다.',[
   {label:c.긴급?.지시?'비상 대응 중 · 경비·보수조 5마리':'경비·보수조 5마리 출동 지시',run:()=>{if(!c.긴급){this.notify('지금은 평온해요.');return;}c.긴급.지시=true;this.notify('경비와 보수조 5마리가 출동했어요.');this.changed();this.close();}},
   {label:c.집결?'각자 일로 돌아가라!':'나를 따르라! · 정원에서 사용',run:()=>{if(this.world.scene!=='outside'){this.notify('정원에서 사용할 수 있어요.',true);return;}c.집결=!c.집결;this.world.commandFollowers(c.집결);this.changed();this.close();}},
   ...['인사','위엄','기쁨','격려'].map(name=>({label:'여왕 모션 · '+name,run:()=>{c.모션=name;this.world.emote(name);this.changed();this.close();}})),
   {label:'공물 받기',run:()=>{this.work('시종들이 공물을 나누는 중',4,()=>{s.inventory.seed+=3;s.queen.tributes++;this.changed();this.notify('씨앗 +3');});}},
   {label:'잎 장식 달기 · 잎 3개',run:()=>{if(s.inventory.leaf<3){this.notify('잎 세 개가 필요해요.');return;}s.inventory.leaf-=3;s.queen.decor++;this.world.nestCache=null;this.changed();this.close();}},
   {label:'오늘은 쉬기',run:()=>this.close()}
  ]);
 }
 expedition(){
  const s=this.state;if(!s.cleared){this.notify('즉위 후에 도전할 수 있어요.');return;}
  const route=s.campaign.원정%3;
  const lines=['바람의 변경에 길을 잃은 원정대가 있어요. 잎 열 개로 대피소를 세우면 이곳과 동맹을 맺을 수 있어요.','이웃 군락이 우리의 힘을 시험합니다. 경비대와 깃발을 지키는 세 차례 훈련을 치러요.','새 영토에 필요한 식량을 나눠요. 씨앗 스무 개로 교역소를 세우면 새로운 군락이 우리 연맹에 들어옵니다.'];
  this.dialogue('바람의 변경 · 원정 '+(s.campaign.원정+1),lines[route],[{label:['잎 10개 · 대피소 동맹','경비와 거점 확보 · 3차전','씨앗 20개 · 교역소 건설'][route],run:()=>{
   const key=route===0?'leaf':'seed',cost=route===0?10:20;
   if(route!==1&&s.inventory[key]<cost){this.notify('필요한 자원을 더 모아 주세요.',true);return;}
   if(route!==1)s.inventory[key]-=cost;
   const resolve=()=>{s.campaign.원정++;s.xp+=160;s.inventory.seed+=5;this.world.emote('기쁨');this.changed();this.save();this.dialogue('새로운 깃발','거점 '+s.campaign.원정+'곳이 열린 문 연맹에 합류했어요. 다음 원정에서는 다른 부탁이 기다립니다.',[{label:'여왕의 일상으로',run:()=>this.close()}]);};
   if(route===1){this.close();this.playerHealth=100;this.bossClock=0;this.attackCooldown=0;this.skirmish={hits:0,resolve};this.notify('거점 공방전! 붉은 원을 피하고 깃발 곁에서 E/상호작용으로 전진하세요. 각 차전 세 번씩, 세 차례를 버텨야 해요.');}
   else this.work('동료들과 거점을 세우는 중',8,resolve);
  }},{label:'다음에 원정하기',run:()=>this.close()}]);
 }
 attack(){
  if(this.attackCooldown>0){this.notify('동료들과 대형을 다시 맞추는 중이에요.');return;}this.attackCooldown=2.8;
  const s=this.state;if(this.world.scene==='frontier'&&this.skirmish){this.skirmish.hits++;this.world.burst(this.world.player.x,this.world.player.y,'#e8bd67',10);if(this.skirmish.hits>=9){const done=this.skirmish.resolve;this.skirmish=null;this.world.bossTelegraph=null;done();}else if(this.skirmish.hits%3===0)this.notify('경비가 다음 방어선을 확보했어요!');return;}
  if(s.campaign.단계!==23)return;
  s.campaign.왕실체력=Math.max(0,s.campaign.왕실체력-5-s.campaign.동맹.length);
  this.world.burst(this.world.player.x,this.world.player.y,'#e8bd67',12);this.changed();
  if(s.campaign.왕실체력<=0){this.world.bossTelegraph=null;this.step('boss','은빛전투');this.clear();}
 }
 tick(dt){
  this.attackCooldown=Math.max(0,this.attackCooldown-dt);
  const s=this.state,c=s.campaign;
  if(c.감옥==='일반'&&c.형기>0){c.형기=Math.max(0,c.형기-dt);if(c.형기===0)this.notify('형기가 끝났어요. 간수에게 말을 걸어 나갈 수 있어요.');}
  const expedition=this.world.scene==='frontier'&&this.skirmish;
  if(!expedition&&(c.단계!==23||this.world.scene!=='throne')){this.strike=null;this.world.bossTelegraph=null;this.bossClock=0;return;}
  this.bossClock+=dt;
  if(!this.strike&&this.bossClock>=3){this.bossClock=0;this.strike={x:this.world.player.x,y:this.world.player.y,radius:85,remaining:1.4};this.world.bossTelegraph=this.strike;this.notify('바닥의 붉은 원 밖으로 피하세요!',true);return;}
  if(this.strike){this.strike.remaining-=dt;this.world.bossTelegraph=this.strike;if(this.strike.remaining<=0){
   if(Math.hypot(this.world.player.x-this.strike.x,this.world.player.y-this.strike.y)<85){this.playerHealth-=25;this.notify('충격! 남은 힘 '+this.playerHealth,true);}
   this.strike=null;this.world.bossTelegraph=null;
   if(this.playerHealth<=0){this.playerHealth=100;c.왕실체력=100;this.skirmish=null;this.dialogue('동료들이 붙잡은 손','모래가 앞을 막고 초롱이 너를 일으킨다. 돌개가 외친다. “다시 일어나. 우린 아직 함께야!”',[{label:expedition?'야영지에서 재정비':'왕실전 다시 도전',run:()=>this.change(expedition?'frontier':'depths')}]);}
  }}
 }
}
