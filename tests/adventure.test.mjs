import test from 'node:test';
import assert from 'node:assert/strict';
import {Adventure} from '../src/adventure.js';
import {createState} from '../src/progression.js';
import {STORY,PASSWORD_OPTIONS,PASSWORD} from '../src/campaign.js';

function harness(){
 const state=createState();let choices=[],text='',cleared=false;
 const world={scene:'nest',player:{x:0,y:0},setMode(scene){this.scene=scene;},getSnapshot(){return {...state.world,scene:this.scene};},setActivity(){},burst(){},emote(){},commandFollowers(){}};
 const adventure=new Adventure({getState:()=>state,getWorld:()=>world,talk:(role,name,line,options)=>{text=line;choices=options;},close:()=>{},work:(label,seconds,done)=>done(),notify:()=>{},changed:()=>{},save:()=>{},stopEvent:()=>{},clear:()=>{cleared=true;}});
 return {state,world,adventure,get choices(){return choices;},get text(){return text;},get cleared(){return cleared;}};
}
test('ordinary imprisonment needs three warnings, permits work/bail/time, story prison never permits bail',()=>{
 const h=harness(),a=h.adventure,s=h.state;
 a.trespass({name:'왕실'});a.trespass({name:'왕실'});assert.equal(s.campaign.감옥,'없음');
 a.trespass({name:'왕실'});assert.equal(s.campaign.감옥,'일반');assert.equal(h.world.scene,'prison');
 a.prison();h.choices[1].run();assert.equal(h.world.scene,'prison');
 h.choices[2].run();assert.equal(s.campaign.형기,30);a.tick(30);a.prison();h.choices[0].run();assert.equal(h.world.scene,'nest');
 s.campaign.감옥='이야기';s.inventory.seed=100;a.prison();assert.equal(h.choices.length,1);h.choices[0].run();assert.equal(s.campaign.감옥,'이야기');
});
test('complete betrayal, escape, password, allies and queen battle through interaction controller',()=>{
 const h=harness(),a=h.adventure,s=h.state;s.questIndex=29;s.rank=4;s.xp=2645;s.inventory.dew=5;s.inventory.crumb=3;
 a.offerCrown();h.choices[1].run();assert.equal(s.campaign.단계,0);
 a.offerCrown();h.choices[0].run();assert.equal(h.world.scene,'prison');assert.equal(s.campaign.단계,1);
 for(let phase=1;phase<23;phase++){
  const q=STORY[phase];
  if(q.type==='enter'){a.portal({destination:q.scene});if(h.world.scene!==q.scene)h.choices[1].run();}
  else{
   h.world.setMode(q.scene);s.world=h.world.getSnapshot();
   if(q.type==='quiz'){
    a.interact({type:'story',id:q.target});h.choices[0].run();assert.equal(s.campaign.암호순서,0);
    a.interact({type:'story',id:q.target});for(let i=0;i<5;i++)h.choices[PASSWORD_OPTIONS[i].indexOf(PASSWORD[i])].run();
   }else for(let i=0;i<(q.type==='deliver'?1:q.count);i++){
    a.interact({type:'story',id:q.target,name:q.target});
    if(['talk','deliver'].includes(q.type))h.choices[0].run();
   }
  }
  assert.equal(s.campaign.단계,phase+1,q.title);
 }
 assert.deepEqual(s.campaign.동맹,['돌개','초롱','모래']);assert.ok(s.xp>=3200);
 a.portal({destination:'throne'});assert.equal(h.world.scene,'throne');
 for(let i=0;i<13;i++){a.attackCooldown=0;a.attack();}
 assert.equal(s.campaign.단계,24);assert.equal(h.cleared,true);
});
test('boss telegraph can be dodged, hits cost health, defeat offers safe retry',()=>{
 const h=harness(),a=h.adventure,s=h.state;s.campaign.단계=23;h.world.scene='throne';
 a.tick(3);h.world.player.x=200;a.tick(1.5);assert.equal(a.playerHealth,100);
 for(let i=0;i<4;i++){a.tick(3);a.tick(1.5);}
 assert.match(h.text,/함께야/);h.choices[0].run();assert.equal(h.world.scene,'depths');assert.equal(s.campaign.왕실체력,100);
});
test('post-clear skirmish takes nine advances with cooldown and can be retried',()=>{
 const h=harness(),a=h.adventure,s=h.state;s.cleared=true;s.campaign.원정=1;h.world.scene='frontier';
 a.expedition();h.choices[0].run();a.attack();a.attack();assert.equal(a.skirmish.hits,1);
 for(let i=0;i<8;i++){a.attackCooldown=0;a.attack();}assert.equal(s.campaign.원정,2);assert.equal(a.skirmish,null);
});
