import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,normalizeState} from '../src/progression.js';
import {STORY,startBetrayal,advanceStory,answerPassword,PASSWORD_OPTIONS,PASSWORD,accessRegion,buyUpgrade,recordRecruit,eligibleEvent,normalizeCampaign} from '../src/campaign.js';
const state=()=>{const s=createState();s.campaign=normalizeCampaign();return s;};
test('story cannot skip objects or regions, and five answers reset on a mistake',()=>{
 const s=state();s.questIndex=29;s.xp=4000;assert.ok(startBetrayal(s));
 assert.equal(advanceStory(s,'inspect','균열'),false);
 for(let step=1;step<24;step++){
  const q=STORY[step];s.world.scene=q.scene;
  if(step===9){assert.ok(!answerPassword(s,0).ok);assert.equal(s.campaign.암호순서,0);for(let i=0;i<5;i++)assert.ok(answerPassword(s,PASSWORD_OPTIONS[i].indexOf(PASSWORD[i])).ok);}
  else assert.ok(advanceStory(s,q.type,q.target,q.count));
  assert.equal(s.campaign.단계,step+1);
 }
 assert.deepEqual(s.campaign.동맹,['돌개','초롱','모래']);
});
test('recruiting existing squad does not inflate help but completes the squad requirement',()=>{
 const s=state();s.questIndex=12;recordRecruit(s,3,3);recordRecruit(s,0,3);assert.equal(s.stats.helped,3);assert.equal(s.questProgress,3);
 s.questIndex=23;recordRecruit(s,2,5);recordRecruit(s,0,5);assert.equal(s.stats.helped,5);assert.equal(s.questProgress,5);
});
test('heavy events require a squad and imprisonment protects from impossible emergencies',()=>{
 const s=state();s.rank=4;s.questIndex=25;
 assert.equal(eligibleEvent(s,{target:'berry'},2),false);assert.equal(eligibleEvent(s,{target:'berry'},3),true);
 s.campaign.감옥='이야기';assert.equal(eligibleEvent(s,{type:'defend'},5),false);
});
test('economic upgrades have costs and limits and cannot spend contribution',()=>{
 const s=state();s.xp=800;s.inventory.seed=100;
 for(let i=0;i<3;i++)assert.ok(buyUpgrade(s,'이동'));
 assert.equal(buyUpgrade(s,'이동'),false);assert.equal(s.inventory.seed,52);assert.equal(s.xp,800);
});
test('gates enforce rank and contribution and three allies for royal access',()=>{
 const s=state();s.rank=2;s.xp=749;assert.ok(accessRegion(s,'moss'));s.xp=750;assert.equal(accessRegion(s,'moss'),'');
 s.campaign.단계=23;assert.ok(accessRegion(s,'throne'));s.campaign.동맹=['돌개','초롱','모래'];assert.equal(accessRegion(s,'throne'),'');
});
test('legacy queens retain their position and legacy excavation is preserved',()=>{
 assert.equal(normalizeCampaign(undefined,{cleared:true,dug:6}).단계,24);
 assert.equal(normalizeCampaign(undefined,{dug:6}).개통,true);
 const s=normalizeState({world:{scene:'depths'},campaign:{'단계':5,'동맹':['돌개'],'형기':-10,'강화':{'이동':99}}});
 assert.equal(s.world.scene,'depths');assert.equal(s.campaign.단계,5);assert.equal(s.campaign.형기,0);assert.equal(s.campaign.강화.이동,3);
});
