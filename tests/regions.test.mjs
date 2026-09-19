import test from 'node:test';
import assert from 'node:assert/strict';
import {World,REGIONS,NEST_ROOMS} from '../src/world.js';
import {createState} from '../src/progression.js';
const canvas=()=>({getContext:()=>({}),getBoundingClientRect:()=>({width:1200,height:800})});
const make=()=>{const w=new World(canvas()),s=createState();s.rank=5;s.cleared=true;s.campaign.단계=24;w.setState(s);return w;};
test('predators never spawn inside an obstacle the player cannot reach',()=>{
 const w=make();w.setMode('outside');
 for(let x=180;x<2400;x+=180)for(let y=180;y<1800;y+=180){
  if(!w.walkable({x,y}))continue;w.player.x=x;w.player.y=y;w.setEvent(null);w.setEvent({id:'침입',type:'defend'});assert.ok(w.walkable(w.predator));
 }
});
test('every new region restores its player and places all story objects in reachable geometry',()=>{
 const w=make();
 for(const scene of Object.keys(REGIONS)){
  w.setMode(scene);assert.ok(w.walkable(w.player),scene+' entry');
  if(scene==='outside')continue;
  for(const e of w.getEntities()){assert.ok(w.walkable(e),scene+' '+e.id);const path=w.currentGraph().route(w.player,e);assert.ok(path.length,scene+' route '+e.id);}
  const snap=w.getSnapshot();w.applySnapshot(snap);assert.equal(w.scene,scene);assert.ok(w.walkable(w.player));
 }
});
test('closed prison passage is hidden until the player excavates the crack',()=>{
 const w=make();w.state.cleared=false;w.state.campaign.단계=1;w.setState(w.state);w.setMode('prison');
 assert.ok(!w.getEntities().some(e=>e.type==='portal'));assert.ok(!w.walkable({x:710,y:280}));
 w.state.campaign.단계=3;w.setState(w.state);assert.ok(w.getEntities().some(e=>e.type==='portal'));assert.ok(w.walkable({x:710,y:280}));
});
test('gate warnings count distinct attempts and legacy saves inside a new locked room can leave',()=>{
 const w=make();w.state.rank=0;w.setState(w.state);const room=NEST_ROOMS.find(r=>r.id==='guard');let warnings=0;w.onTrespass=()=>warnings++;
 w.player.x=1320;w.player.y=761;w.setInput(1,.8);
 for(let i=0;i<200;i++)w.update(.08);assert.equal(warnings,1);
 w.setInput(0,0);for(let i=0;i<10;i++)w.update(.08);w.setInput(1,.8);w.update(.08);assert.equal(warnings,2);
 w.applySnapshot({scene:'nest',x:room.x,y:room.y,dug:0});assert.equal(w.blockedRoom(w.player),undefined);assert.ok(w.walkable(w.player));
});
test('ambient crew reaches the last wall but only a nearby player opens it',()=>{
 const w=make();w.state.campaign.개통=false;w.setDug(6);w.ambientWork=159;w.update(1);assert.equal(w.dug,7);
 w.ambientWork=159.98;w.update(.08);assert.equal(w.graph.open,false);assert.equal(w.dug,7);assert.equal(w.dig().opened,false);
 Object.assign(w.player,w.nestEntities.find(e=>e.id==='dig'));assert.equal(w.dig().opened,true);assert.ok(w.graph.rooms.some(r=>r.id==='new-room'));
});
test('home pheromones are walkable, guards invade with predator and queen workers rally',()=>{
 const w=make();w.setMode('outside');w.player.x=500;w.player.y=1200;assert.equal(w.toggleHomeTrail(),true);assert.ok(w.homePath.length>1);
 for(let i=1;i<w.homePath.length;i++)for(let j=0;j<=20;j++){const a=w.homePath[i-1],b=w.homePath[i];assert.ok(w.walkable({x:a.x+(b.x-a.x)*j/20,y:a.y+(b.y-a.y)*j/20}),'pheromone through obstacle');}
 w.setEvent({id:'test',type:'defend',remaining:19,count:12,progress:0});w.update(.08);assert.equal(w.predator.scene,'nest');assert.ok(w.guardAnts.every(a=>a.scene==='nest'));
 w.setEvent(null);w.commandFollowers(true);for(let i=0;i<300;i++)w.update(.08);assert.ok(w.gardenWorkers.every(a=>Math.hypot(a.x-w.player.x,a.y-w.player.y)<180));
 w.recruit(5);w.setActivity({x:w.player.x+50,y:w.player.y,kind:'crumb'});for(let i=0;i<100;i++)w.update(.08);assert.ok(w.followers.every(a=>a.carry==='crumb'));assert.ok(w.followers.some(a=>a.moving));
});
