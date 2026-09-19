// Original, locally synthesised music. No audio downloads or background timers.
const THEMES = {
  life: { beat: .34, melody: [72,76,79,76,74,77,81,79,76,79,84,83,81,79,76,74], chords: [[60,64,67],[57,60,64],[65,69,72],[55,59,62]], voice: 'triangle' },
  depths: { beat: .46, melody: [69,null,72,76,74,null,72,67,69,71,72,null,67,64,67,null], chords: [[57,60,64],[53,57,60],[55,59,62],[52,55,59]], voice: 'sine' },
  danger: { beat: .25, melody: [69,69,72,71,69,76,74,72,67,67,71,69,67,74,72,71], chords: [[57,60,64],[53,57,60],[55,59,62],[52,56,59]], voice: 'triangle' },
  battle: { beat: .21, melody: [69,76,72,76,71,76,74,76,72,79,76,79,71,74,68,71], chords: [[57,60,64],[53,57,60],[55,59,62],[52,56,59]], voice: 'triangle' },
  royal: { beat: .37, melody: [72,76,79,84,83,79,76,79,81,77,74,77,79,76,72,null], chords: [[60,64,67],[55,59,62],[57,60,64],[65,69,72]], voice: 'triangle' }
};
const hz = note => 440 * 2 ** ((note - 69) / 12);
const volume = value => Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : 0;

export class Sound {
  constructor() {
    this.ctx = null; this.bgm = .35; this.sfx = .6; this.enabled = false;
    this.theme = 'life'; this.next = 0; this.step = 0; this.voices = new Set();
  }
  unlock() {
    try {
      if (!this.ctx) {
        const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!Audio) return;
        this.ctx = new Audio();
        this.musicBus = this.ctx.createGain(); this.effectBus = this.ctx.createGain();
        this.limiter = this.ctx.createDynamicsCompressor();
        this.limiter.threshold.value = -7; this.limiter.knee.value = 5;
        this.limiter.ratio.value = 12; this.limiter.attack.value = .003; this.limiter.release.value = .18;
        this.musicBus.connect(this.limiter); this.effectBus.connect(this.limiter);
        this.limiter.connect(this.ctx.destination);
        this.setVolumes(this.bgm, this.sfx);
      }
      this.ctx.resume().catch(() => {}); this.enabled = true;
    } catch { /* Browsers without Web Audio can still play the game. */ }
  }
  setVolumes(bgm, sfx) {
    this.bgm = volume(bgm); this.sfx = volume(sfx);
    if (!this.ctx) return;
    // Bus gain changes notes that are already sounding as well as future notes.
    for (const [bus, value] of [[this.musicBus, this.bgm], [this.effectBus, this.sfx]]) {
      bus.gain.cancelScheduledValues(this.ctx.currentTime);
      bus.gain.setTargetAtTime(value, this.ctx.currentTime, .015);
    }
  }
  setTheme(theme) {
    if (!THEMES[theme] || theme === this.theme) return;
    this.theme = theme; this.step = 0;
    this.stopMusic(); this.next = this.ctx?.currentTime || 0;
  }
  note(frequency, duration, gain, type, when, bus, slide = null) {
    if (!this.ctx || this.ctx.state !== 'running' || gain <= 0) return;
    const oscillator = this.ctx.createOscillator(), envelope = this.ctx.createGain();
    const start = Math.max(this.ctx.currentTime, when), end = start + Math.max(.04, duration);
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, start);
    if (slide) oscillator.frequency.exponentialRampToValueAtTime(slide, end);
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(gain, start + Math.min(.012, duration / 4));
    envelope.gain.exponentialRampToValueAtTime(.0001, end);
    oscillator.connect(envelope); envelope.connect(bus);
    const voice = { oscillator, envelope, music: bus === this.musicBus };
    this.voices.add(voice);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); this.voices.delete(voice); };
    oscillator.start(start); oscillator.stop(end + .025);
  }
  // Public tone is an effect; its gain is before the SFX volume bus.
  tone(frequency, duration, gain, type = 'sine', delay = 0) {
    if (this.ctx) this.note(frequency, duration, gain, type, this.ctx.currentTime + delay, this.effectBus);
  }
  stopMusic() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const voice of this.voices) if (voice.music) {
      voice.envelope.gain.cancelScheduledValues(now);
      voice.envelope.gain.setTargetAtTime(0, now, .015);
      try { voice.oscillator.stop(now + .07); } catch {}
    }
  }
  tick(_dt, playing) {
    if (!playing) { this.stopMusic(); this.next = 0; return; }
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    // Never replay an accumulated backlog after a hidden tab or a long dialogue.
    if (this.next < now - .15) this.next = now;
    const song = THEMES[this.theme];
    while (this.next < now + .1) {
      const step = this.step++, beat = step % 16, chord = song.chords[Math.floor(step / 8) % 4];
      const melody = song.melody[beat];
      if (this.bgm > 0) {
        if (melody !== null) this.note(hz(melody), song.beat * 1.7, .23, song.voice, this.next, this.musicBus);
        if (step % 4 === 0) {
          for (const pitch of chord) this.note(hz(pitch), song.beat * 4, .075, 'sine', this.next, this.musicBus);
          // Bass harmonics remain audible on small phone speakers.
          this.note(hz(chord[0] - 12), song.beat * 2.4, .17, 'triangle', this.next, this.musicBus);
        }
        if (this.theme !== 'depths') {
          if (step % 2 === 0) this.note(155, .12, .13, 'sine', this.next, this.musicBus, 65);
          else this.note(1300, .045, .038, 'triangle', this.next, this.musicBus, 650);
        }
      }
      this.next += song.beat;
    }
  }
  play(kind) {
    if (!this.sfx) return;
    if (kind === 'rank' || kind === 'clear') {
      [261.6,329.6,392,523.2,659.2].forEach((f, i) => this.tone(f, .85, .25, 'triangle', i * .12));
    } else if (kind === 'work') {
      this.tone(190, .14, .23, 'triangle'); this.tone(280, .17, .15, 'sine', .05);
    } else if (kind === 'reward') {
      this.tone(523, .32, .23, 'triangle'); this.tone(659, .45, .21, 'sine', .12);
    } else if (kind === 'event') {
      [392,293,392].forEach((f, i) => this.tone(f, .35, .26, 'triangle', i * .2));
    } else this.tone(540, .08, .14, 'sine');
  }
  suspend() { this.stopMusic(); this.ctx?.suspend().catch(() => {}); }
  resume() { if (this.enabled) { this.next = this.ctx?.currentTime || 0; this.ctx?.resume().catch(() => {}); } }
}

