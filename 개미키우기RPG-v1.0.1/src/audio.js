// Soft procedural woodland music: no downloaded audio or runtime dependencies.
export class Sound {
  constructor(){this.ctx=null;this.bgm=.35;this.sfx=.6;this.enabled=false;this.next=0;this.step=0;}
  unlock(){try{if(!this.ctx){this.ctx=new (window.AudioContext||window.webkitAudioContext)();}this.ctx.resume().catch(()=>{});this.enabled=true;}catch{}}
  setVolumes(bgm,sfx){this.bgm=bgm;this.sfx=sfx;}
  tone(frequency,duration,gain,type='sine',delay=0){if(!this.ctx||this.ctx.state!=='running'||gain<=0)return;const t=this.ctx.currentTime+delay,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.value=frequency;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(gain,t+.025);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(this.ctx.destination);o.start(t);o.stop(t+duration+.02);o.onended=()=>{o.disconnect();g.disconnect();};}
  tick(dt,playing){if(!playing||!this.enabled||!this.ctx)return;this.next-=dt;if(this.next>0)return;this.next=1.65;const notes=[261.63,329.63,392,440,392,329.63,293.66,329.63,261.63,196,220,293.66,329.63,392,329.63,261.63];const f=notes[this.step++%notes.length];this.tone(f,1.8,.027*this.bgm);this.tone(f/2,2.5,.020*this.bgm);if(this.step%4===0)this.tone(f*1.5,1.2,.014*this.bgm,'sine',.18);}
  play(kind){const v=this.sfx;if(kind==='rank'||kind==='clear'){[261.6,329.6,392,523.2,659.2].forEach((f,i)=>this.tone(f,1.1,.065*v,'sine',i*.12));}else if(kind==='work'){this.tone(190,.13,.04*v,'triangle');this.tone(280,.16,.025*v,'sine',.05);}else if(kind==='reward'){this.tone(523,.35,.05*v);this.tone(659,.5,.04*v,'sine',.12);}else if(kind==='event'){this.tone(392,.5,.045*v);this.tone(293,.7,.045*v,'sine',.17);}else this.tone(440,.12,.022*v);}
  suspend(){this.ctx?.suspend().catch(()=>{});}
  resume(){if(this.enabled)this.ctx?.resume().catch(()=>{});}
}

